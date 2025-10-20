import type { Metadata } from 'next';
import Section from '../_components/Section';

export const metadata: Metadata = {
  title: 'Privacy Policy — Aura Wellness Aesthetics',
  description: 'Privacy policy and data protection information for Aura Wellness Aesthetics clients.',
};

export default function Privacy() {
  return (
    <>
      <Section background="sand">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-6">
            Privacy Policy
          </h1>
          <p className="text-warm-gray mb-4">
            <strong>Effective Date:</strong> [To be determined at launch]
          </p>
        </div>
      </Section>

      <Section background="ivory">
        <div className="max-w-4xl mx-auto space-y-8 text-warm-gray leading-relaxed">
          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Information We Collect</h2>
            <p className="mb-4">
              Aura Wellness Aesthetics collects personal information necessary to provide skincare services, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Contact information (name, email, phone number, address)</li>
              <li>Medical history and skin concerns</li>
              <li>Appointment and treatment records</li>
              <li>Payment information (processed securely through third-party processors)</li>
              <li>Photos (only with your explicit written consent)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">How We Use Your Information</h2>
            <p className="mb-4">We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide and customize skincare treatments</li>
              <li>Communicate about appointments, services, and promotions</li>
              <li>Maintain treatment records for continuity of care</li>
              <li>Process payments</li>
              <li>Improve our services and client experience</li>
            </ul>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Data Protection</h2>
            <p>
              We implement industry-standard security measures to protect your personal information. Your data is stored securely and accessed only by authorized personnel for legitimate business purposes.
            </p>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Third-Party Services</h2>
            <p className="mb-4">
              We may use third-party services for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Appointment scheduling and reminders</li>
              <li>Payment processing</li>
              <li>Email communications</li>
              <li>Website analytics</li>
            </ul>
            <p className="mt-4">
              These providers are contractually obligated to protect your information and use it only for the services they provide to us.
            </p>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access your personal information</li>
              <li>Request corrections to your data</li>
              <li>Request deletion of your information (subject to legal requirements)</li>
              <li>Opt out of marketing communications</li>
              <li>Withdraw photo consent at any time</li>
            </ul>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Contact Us</h2>
            <p>
              For questions about this privacy policy or to exercise your rights, contact us at:
              <br />
              <strong>Email:</strong> hello@auraesthetics.com
              <br />
              <strong>Location:</strong> Fort Lauderdale, FL
            </p>
          </div>

          <div className="pt-8 border-t border-sand">
            <p className="text-sm italic">
              This privacy policy may be updated from time to time. We will notify clients of significant changes via email or posted notice.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}

