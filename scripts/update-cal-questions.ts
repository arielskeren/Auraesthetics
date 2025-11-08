import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { calRequest } from '../lib/calClient';

dotenv.config({ path: '.env.local' });

const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY;

if (!CAL_COM_API_KEY) {
  console.error('❌ Error: CAL_COM_API_KEY not set in .env.local');
  process.exit(1);
}

const IDENTIFIERS_TO_LOCK = new Set(['name', 'email', 'smsReminderNumber', 'notes']);

interface Service {
  name: string;
  calEventId: number | null;
}

interface CalQuestion {
  id: number;
  identifier?: string;
  prefillDisabled?: boolean;
  disableOnPrefill?: boolean;
  [key: string]: any;
}

async function fetchQuestions(eventTypeId: number): Promise<CalQuestion[]> {
  try {
    const response = await calRequest<any>('get', `event-types/${eventTypeId}/questions`);
    const payload = response.data ?? response?.questions ?? response ?? [];
    if (Array.isArray(payload)) {
      return payload;
    }
    if (Array.isArray(payload?.questions)) {
      return payload.questions;
    }
    return [];
  } catch (error: any) {
    console.error(`❌ Failed to fetch questions for event ${eventTypeId}:`, error.response?.data || error.message);
    return [];
  }
}

async function updateQuestion(eventTypeId: number, question: CalQuestion): Promise<boolean> {
  try {
    await calRequest('patch', `event-types/${eventTypeId}/questions/${question.id}`, {
      prefillDisabled: true,
      disableOnPrefill: true,
    });
    return true;
  } catch (error: any) {
    console.error(
      `❌ Failed to update question ${question.id} (${question.identifier}) for event ${eventTypeId}:`,
      error.response?.data || error.message
    );
    return false;
  }
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Updating Cal.com questions to lock prefilled fields...\n');

  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
  const services: Service[] = JSON.parse(servicesContent);

  const servicesWithEvents = services.filter((service) => service.calEventId);

  if (servicesWithEvents.length === 0) {
    console.log('⚠️  No services with Cal event IDs found. Nothing to update.');
    return;
  }

  const updated: { service: Service; questions: string[] }[] = [];
  const skipped: { service: Service; reason: string }[] = [];

  for (const service of servicesWithEvents) {
    const eventTypeId = service.calEventId!;
    console.log(`\n📋 Processing "${service.name}" (Event ID ${eventTypeId})`);

    const questions = await fetchQuestions(eventTypeId);

    if (questions.length === 0) {
      skipped.push({ service, reason: 'No questions returned from API' });
      continue;
    }

    const targets = questions.filter((question) => {
      const identifier = question.identifier ?? '';
      return IDENTIFIERS_TO_LOCK.has(identifier) && !question.prefillDisabled && !question.disableOnPrefill;
    });

    if (targets.length === 0) {
      console.log('   ✅ All required questions already lock prefilled values.');
      continue;
    }

    const updatedIdentifiers: string[] = [];

    for (const question of targets) {
      const identifier = question.identifier || `question-${question.id}`;
      console.log(`   🔒 Locking question "${identifier}"`);
      const success = await updateQuestion(eventTypeId, question);
      if (success) {
        updatedIdentifiers.push(identifier);
      }
      await delay(350);
    }

    if (updatedIdentifiers.length > 0) {
      updated.push({ service, questions: updatedIdentifiers });
    }
  }

  console.log('\n📊 Summary');
  if (updated.length > 0) {
    console.log(`   ✅ Updated ${updated.length} event types:`);
    updated.forEach(({ service, questions }) => {
      console.log(`     • ${service.name}: ${questions.join(', ')}`);
    });
  } else {
    console.log('   ✅ No updates needed.');
  }

  if (skipped.length > 0) {
    console.log('\n   ⚠️  Skipped:');
    skipped.forEach(({ service, reason }) => {
      console.log(`     • ${service.name}: ${reason}`);
    });
  }

  console.log('\n✨ Done!');
}

run().catch((error) => {
  console.error('Unexpected error while updating Cal questions:', error);
  process.exit(1);
});


