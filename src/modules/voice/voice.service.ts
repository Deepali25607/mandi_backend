import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '@/common/decorators/current-user.decorator';
import { ASSIGNABLE_SCREENS } from '@/common/config/screens';
import { PaymentMode, TransferDirection } from '@/common/enums/domain.enum';
import { Role } from '@/common/enums/role.enum';
import { BankAccountsService } from '@/modules/bank-accounts/bank-accounts.service';
import { CashTransfersService } from '@/modules/cash-transfers/cash-transfers.service';
import { CollectionsService } from '@/modules/collections/collections.service';
import { Collection } from '@/modules/collections/collection.entity';
import { CustomersService } from '@/modules/customers/customers.service';
import { ExpensesService } from '@/modules/expenses/expenses.service';
import { Expense } from '@/modules/expenses/expense.entity';
import { OutstandingService } from '@/modules/outstanding/outstanding.service';
import { Sale } from '@/modules/sales/sale.entity';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const WHISPER_MODEL = 'whisper-large-v3';
// 8b-instant handles this structured extraction fine and has far higher
// free-tier daily limits than the 70b model (which we exhausted in testing).
const DEFAULT_CHAT_MODEL = 'llama-3.1-8b-instant';

/** What the LLM extracts from the transcript. */
interface ParsedIntent {
  intent: 'navigate' | 'record_collection' | 'record_expense' | 'record_cash_transfer' | 'query_report' | 'none';
  path?: string;
  customerName?: string;
  amount?: number;
  paymentMode?: string;
  category?: string;
  direction?: string;
  bankName?: string;
  notes?: string;
  reply?: string;
  /** query_report fields */
  metric?: 'sales' | 'collections' | 'expenses' | 'outstanding';
  from?: string;
  to?: string;
  rangeLabel?: string;
}

/** What the frontend receives back. */
export interface VoiceCommandResult {
  transcript: string;
  intent: ParsedIntent['intent'];
  /** navigate → frontend should route to `path`; created → a record was saved. */
  action: 'navigate' | 'created' | 'none';
  path?: string;
  message: string;
}

@Injectable()
export class VoiceService {
  constructor(
    private readonly config: ConfigService,
    private readonly customers: CustomersService,
    private readonly collections: CollectionsService,
    private readonly expenses: ExpensesService,
    private readonly cashTransfers: CashTransfersService,
    private readonly bankAccounts: BankAccountsService,
    private readonly outstanding: OutstandingService,
    @InjectRepository(Sale) private readonly salesRepo: Repository<Sale>,
    @InjectRepository(Collection) private readonly collectionsRepo: Repository<Collection>,
    @InjectRepository(Expense) private readonly expensesRepo: Repository<Expense>,
  ) {}

  private apiKey(): string {
    const key = this.config.get<string>('GROQ_API_KEY');
    if (!key) throw new ServiceUnavailableException('GROQ_API_KEY is not configured on the server.');
    return key;
  }

  async handleCommand(
    user: AuthUser,
    input: { audio?: string; mimeType?: string; text?: string },
  ): Promise<VoiceCommandResult> {
    if (!input.audio && !input.text?.trim()) {
      throw new BadRequestException('Send either an audio clip or a text message.');
    }
    const transcript = input.text?.trim() || (await this.transcribe(input.audio!, input.mimeType)).trim();
    if (!transcript) {
      return { transcript: '', intent: 'none', action: 'none', message: "I couldn't hear anything — please try again." };
    }
    const parsed = await this.parseIntent(transcript);
    return this.execute(user, transcript, parsed);
  }

  /** Speech → text via Groq's hosted Whisper. */
  private async transcribe(audioBase64: string, mimeType = 'audio/webm'): Promise<string> {
    const buffer = Buffer.from(audioBase64, 'base64');
    if (buffer.length === 0) throw new BadRequestException('Empty audio clip.');

    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType }), `command.${ext}`);
    form.append('model', WHISPER_MODEL);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    // Pin the language: auto-detect misfires badly on short clips (Hindi speech
    // came back as unrelated English). 'hi' also handles Hinglish + English
    // loan-words fine. Override with VOICE_LANGUAGE if a tenant speaks another
    // language.
    form.append('language', this.config.get<string>('VOICE_LANGUAGE', 'hi'));
    // Bias Whisper toward the vocabulary it will actually hear — short mandi
    // commands. Without this, brief clips often get hallucinated.
    form.append(
      'prompt',
      'मंडी ERP के छोटे voice commands, जैसे: collections kholo; sales dikhao; रमेश से 5000 रुपये cash आये; 200 रुपये चाय का खर्चा; 10 हज़ार bank में जमा करो; bank से 2000 निकालो; open dashboard.',
    );

    const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey()}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new ServiceUnavailableException(`Transcription failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as { text?: string };
    return data.text ?? '';
  }

  /** Text → structured intent via a Groq LLM (JSON mode). */
  private async parseIntent(transcript: string): Promise<ParsedIntent> {
    const screens = ASSIGNABLE_SCREENS.map((s) => `${s.path} — ${s.label}`).join('\n');
    const today = new Date().toISOString().slice(0, 10);

    const system = `You are the voice-command parser for a mandi (wholesale market) ERP. Today is ${today}.
Turn the user's spoken command into ONE JSON object, nothing else.
The command may be in Hindi (Devanagari script), Hinglish or English — understand all three.
IMPORTANT: return customerName, bankName and category transliterated to English/Latin letters
(e.g. "रमेश" → "Ramesh", "चाय" → "tea"), because database records are stored in English.

Intents:
1. "navigate" — open a screen. Set "path" to one of:
${screens}
2. "record_collection" — a payment received from a customer (ugrahi/collection/payment aayi).
   Fields: customerName (as spoken), amount (number, rupees), paymentMode ("cash"|"upi"|"bank", default "cash"), notes.
3. "record_expense" — money spent (kharcha). Fields: category (e.g. labour, transport, tea, electricity, rent, miscellaneous), amount, paymentMode ("cash"|"upi"|"bank", default "cash"), notes.
4. "record_cash_transfer" — moving the shop's own money between cash and bank.
   Fields: direction ("cash_to_bank" for deposit/jama, "bank_to_cash" for withdraw/nikalna), amount, bankName (if spoken).
5. "query_report" — the user ASKS about business numbers (kitna/कितना, batao/बताओ, report, total).
   Fields: metric ("sales"|"collections"|"expenses"|"outstanding"), from and to (YYYY-MM-DD dates
   computed from today's date; e.g. "aaj"=today, "kal"=yesterday, "last week"=the previous
   Monday–Sunday, "is month"=1st of this month to today), rangeLabel (short human label like "last week").
   For "outstanding" no dates are needed.
6. "none" — anything else. Set "reply" to a one-line friendly answer in simple Hinglish (Roman script) telling the user what you can do.

Rules:
- Interpret lakh = 100000, hazaar/हज़ार/thousand = 1000. "5 hazaar" → 5000.
- Words like open/show/kholo/खोलो/dikhao/दिखाओ mean NAVIGATE — even if the screen name sounds like a record type ("कलेक्शन खोलो" is navigation, not a payment).
- Only use intents 2-4 when an actual transaction is being dictated (usually has an amount and a party/category).
- Respond with a single JSON object with an "intent" key.

Examples:
"कलेक्शन खोलो" → {"intent":"navigate","path":"/collections"}
"sales dikhao" → {"intent":"navigate","path":"/sales"}
"रमेश से 5000 रुपये cash आये" → {"intent":"record_collection","customerName":"Ramesh","amount":5000,"paymentMode":"cash"}
"200 रुपये चाय का खर्चा" → {"intent":"record_expense","category":"tea","amount":200,"paymentMode":"cash"}
"10 हज़ार bank में जमा करो" → {"intent":"record_cash_transfer","direction":"cash_to_bank","amount":10000}
"बैंक से 2000 निकालो" → {"intent":"record_cash_transfer","direction":"bank_to_cash","amount":2000}
"आज का सेल कितना हुआ" → {"intent":"query_report","metric":"sales","from":"${today}","to":"${today}","rangeLabel":"aaj"}
"लास्ट वीक का सेल रिपोर्ट बताओ" → {"intent":"query_report","metric":"sales","from":"<prev Monday>","to":"<prev Sunday>","rangeLabel":"last week"}
"kitna outstanding hai" → {"intent":"query_report","metric":"outstanding"}`;

    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.get<string>('GROQ_CHAT_MODEL', DEFAULT_CHAT_MODEL),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: transcript },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new ServiceUnavailableException(`Intent parsing failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    try {
      return JSON.parse(data.choices[0]?.message?.content ?? '{}') as ParsedIntent;
    } catch {
      return { intent: 'none', reply: 'Sorry, I could not understand that command.' };
    }
  }

  private async execute(user: AuthUser, transcript: string, parsed: ParsedIntent): Promise<VoiceCommandResult> {
    const base = { transcript, intent: parsed.intent };
    switch (parsed.intent) {
      case 'navigate': {
        const screen = ASSIGNABLE_SCREENS.find((s) => s.path === parsed.path);
        if (!screen) return { ...base, action: 'none', message: "I couldn't match that to a screen." };
        return { ...base, action: 'navigate', path: screen.path, message: `Opening ${screen.label}.` };
      }

      case 'record_collection': {
        this.assertCan(user, [Role.ACCOUNTANT, Role.COLLECTION_EXECUTIVE]);
        const amount = this.requireAmount(parsed.amount);
        if (!parsed.customerName) throw new BadRequestException('Please say the customer name.');
        const customer = await this.resolveCustomer(user.organizationId!, parsed.customerName);
        const rec = await this.collections.create(user, {
          date: this.today(),
          customerId: customer.id,
          amount,
          paymentMode: this.toMode(parsed.paymentMode),
          notes: this.noteFrom(transcript, parsed.notes),
        });
        return {
          ...base, action: 'created',
          message: `${rec.collectionNumber}: recorded ₹${amount} ${rec.paymentMode} collection from ${customer.name}.`,
        };
      }

      case 'record_expense': {
        this.assertCan(user, [Role.ACCOUNTANT]);
        const amount = this.requireAmount(parsed.amount);
        const rec = await this.expenses.create(user, {
          date: this.today(),
          category: parsed.category ?? 'miscellaneous',
          amount,
          paymentMode: this.toMode(parsed.paymentMode),
          notes: this.noteFrom(transcript, parsed.notes),
        });
        return { ...base, action: 'created', message: `${rec.expenseNumber}: recorded ₹${amount} ${rec.category} expense.` };
      }

      case 'record_cash_transfer': {
        this.assertCan(user, [Role.ACCOUNTANT]);
        const amount = this.requireAmount(parsed.amount);
        const direction = parsed.direction === 'bank_to_cash' ? TransferDirection.BANK_TO_CASH : TransferDirection.CASH_TO_BANK;
        const account = await this.resolveBankAccount(user.organizationId!, parsed.bankName);
        const rec = await this.cashTransfers.create(user, {
          date: this.today(),
          direction,
          bankAccountId: account.id,
          amount,
          notes: this.noteFrom(transcript, parsed.notes),
        });
        const verb = direction === TransferDirection.CASH_TO_BANK ? 'deposited to' : 'withdrawn from';
        return { ...base, action: 'created', message: `${rec.transferNumber}: ₹${amount} ${verb} ${account.name}.` };
      }

      case 'query_report':
        return { ...base, action: 'none', message: await this.answerQuery(user, parsed) };

      default:
        return { ...base, action: 'none', message: parsed.reply ?? 'Main screens khol sakta hoon, entries record kar sakta hoon, aur sales/collections/kharcha/outstanding bata sakta hoon.' };
    }
  }

  /** Answers "kitna hua" questions with real aggregates. */
  private async answerQuery(user: AuthUser, parsed: ParsedIntent): Promise<string> {
    const org = user.organizationId!;
    const branch = user.branchId!;

    if (parsed.metric === 'outstanding') {
      const s = await this.outstanding.summary(org);
      return `Outstanding: ₹${this.fmt(s.receivable)} lena hai (receivable), ₹${this.fmt(s.payable)} dena hai (payable).`;
    }

    const from = parsed.from ?? this.today();
    const to = parsed.to ?? from;
    const label = parsed.rangeLabel ?? (from === to ? from : `${from} se ${to}`);

    switch (parsed.metric) {
      case 'sales': {
        const { total, count } = await this.sumBetween(this.salesRepo, 's', 'gross_amount', org, branch, from, to);
        return `${label} ka sale: ₹${this.fmt(total)} (${count} bill). Detail ke liye boliye "open reports".`;
      }
      case 'collections': {
        const { total, count } = await this.sumBetween(this.collectionsRepo, 'c', 'amount', org, branch, from, to);
        return `${label} ki collection: ₹${this.fmt(total)} (${count} receipt).`;
      }
      case 'expenses': {
        const { total, count } = await this.sumBetween(this.expensesRepo, 'e', 'amount', org, branch, from, to);
        return `${label} ka kharcha: ₹${this.fmt(total)} (${count} entries).`;
      }
      default:
        return 'Main sales, collections, kharcha ya outstanding bata sakta hoon — jaise "aaj ka sale kitna hua".';
    }
  }

  private async sumBetween(
    repo: Repository<Sale | Collection | Expense>,
    alias: string,
    column: string,
    org: string,
    branch: string,
    from: string,
    to: string,
  ): Promise<{ total: number; count: number }> {
    const row = await repo
      .createQueryBuilder(alias)
      .select(`COALESCE(SUM(${alias}.${column}),0)`, 'total')
      .addSelect('COUNT(*)', 'count')
      .where(`${alias}.organization_id = :org AND ${alias}.branch_id = :branch AND ${alias}.date BETWEEN :from AND :to`, { org, branch, from, to })
      .getRawOne<{ total: string; count: string }>();
    return { total: parseFloat(row?.total ?? '0'), count: parseInt(row?.count ?? '0', 10) };
  }

  private fmt(n: number): string {
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  // ---- helpers ----

  private assertCan(user: AuthUser, roles: Role[]): void {
    const granted = [user.role, ...(user.grantedRoles ?? [])];
    if (granted.includes(Role.ORG_ADMIN)) return;
    if (!roles.some((r) => granted.includes(r))) {
      throw new ForbiddenException('Your role does not allow recording this by voice.');
    }
  }

  private requireAmount(amount?: number): number {
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("I didn't catch the amount — please say it again.");
    }
    return amount;
  }

  private toMode(mode?: string): PaymentMode {
    if (mode === 'upi') return PaymentMode.UPI;
    if (mode === 'bank') return PaymentMode.BANK;
    return PaymentMode.CASH;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private noteFrom(transcript: string, notes?: string): string {
    return notes ? `${notes} (via voice: "${transcript}")` : `Via voice: "${transcript}"`;
  }

  private async resolveCustomer(organizationId: string, spokenName: string) {
    const matches = (await this.customers.findAll(organizationId, spokenName)).filter((c) => c.isActive);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      // Prefer an exact (case-insensitive) name match before giving up.
      const exact = matches.find((c) => c.name.toLowerCase() === spokenName.toLowerCase());
      if (exact) return exact;
      throw new BadRequestException(
        `"${spokenName}" matches several customers (${matches.slice(0, 3).map((c) => c.name).join(', ')}…) — please be more specific.`,
      );
    }
    throw new BadRequestException(`No customer found matching "${spokenName}".`);
  }

  private async resolveBankAccount(organizationId: string, spokenName?: string) {
    const accounts = (await this.bankAccounts.list(organizationId)).filter((a) => a.isActive);
    if (accounts.length === 0) throw new BadRequestException('No active bank accounts — add one first.');
    if (!spokenName) {
      if (accounts.length === 1) return accounts[0];
      throw new BadRequestException(
        `Which bank? You have: ${accounts.map((a) => a.name).join(', ')}.`,
      );
    }
    const needle = spokenName.toLowerCase();
    const match = accounts.find(
      (a) => a.name.toLowerCase().includes(needle) || (a.bankName ?? '').toLowerCase().includes(needle),
    );
    if (!match) throw new BadRequestException(`No bank account matching "${spokenName}".`);
    return match;
  }
}
