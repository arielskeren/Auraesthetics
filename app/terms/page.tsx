import type { Metadata } from 'next';
import Section from '../_components/Section';

export const metadata: Metadata = {
  title: 'Terms of Service — Aura Wellness Aesthetics',
  description: 'Terms and conditions for services provided by Aura Wellness Aesthetics.',
};

export default function Terms() {
  return (
    <>
      <Section background="sand">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-6">
            Terms of Service
          </h1>
          <p className="text-warm-gray mb-4">
            <strong>Effective Date:</strong> [To be determined at launch]
          </p>
        </div>
      </Section>

      <Section background="ivory">
        <div className="max-w-4xl mx-auto space-y-8 text-warm-gray leading-relaxed">
          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Appointment Booking</h2>
            <p>
              By booking an appointment with Aura Wellness Aesthetics, you agree to these terms and conditions. Appointments are confirmed upon receipt of payment or booking deposit (if applicable).
            </p>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Cancellation Policy</h2>
            <p className="mb-4">
              We understand that schedules change. Our cancellation policy is designed to be fair to both clients and our business:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>72+ hours notice:</strong> Full refund (minus processing fee)</li>
              <li><strong>48-72 hours notice:</strong> 50% refund</li>
              <li><strong>Within 24 hours:</strong> No refund, but receive 25% off your next service (up to 50% of cancelled service value)</li>
              <li><strong>No-shows:</strong> Treated as 24-hour cancellations</li>
              <li><strong>Late arrivals:</strong> Appointment time may be shortened based on schedule availability</li>
            </ul>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Client Responsibilities</h2>
            <p className="mb-4">To ensure safe and effective treatments, clients must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate medical history and current medications</li>
              <li>Disclose any allergies, sensitivities, or contraindications</li>
              <li>Follow pre-care and post-care instructions</li>
              <li>Arrive on time for scheduled appointments</li>
              <li>Notify us immediately of any adverse reactions</li>
            </ul>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Treatment Acknowledgment</h2>
            <p className="mb-4">
              Skincare treatments may involve some risks. By receiving services, you acknowledge that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Results vary by individual and are not guaranteed</li>
              <li>Some redness, sensitivity, or minor reactions may occur</li>
              <li>You have disclosed all relevant medical information</li>
              <li>You have read and understood contraindications</li>
              <li>You will follow all aftercare instructions</li>
            </ul>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Payment Terms</h2>
            <p className="mb-4">
              Payment is due at the time of service unless other arrangements have been made. We accept:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Credit/debit cards</li>
              <li>Digital payment methods</li>
              <li>Cash</li>
            </ul>
            <p className="mt-4">
              Gratuity is appreciated but never expected. Digital gratuity options are available.
            </p>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Refund Policy</h2>
            <p>
              Refunds are provided according to our cancellation policy. Service refunds are evaluated on a case-by-case basis. If you are unsatisfied with your service, please contact us within 48 hours to discuss options.
            </p>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Liability</h2>
            <p>
              Aura Wellness Aesthetics and Amy are not liable for adverse reactions resulting from undisclosed medical conditions, failure to follow pre/post-care instructions, or conditions outside our reasonable control. We maintain professional liability insurance.
            </p>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Minors</h2>
            <p>
              Clients under 18 must have written parental or guardian consent. A parent or guardian must be present for all services for clients under 16.
            </p>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Clients will be notified of significant changes. Continued use of services constitutes acceptance of updated terms.
            </p>
          </div>

          <div>
            <h2 className="text-h2 font-serif text-charcoal mb-4">Contact</h2>
            <p>
              Questions about these terms? Contact us at:
              <br />
              <strong>Email:</strong> hello@auraesthetics.com
              <br />
              <strong>Location:</strong> Fort Lauderdale, FL
            </p>
          </div>

          <div className="pt-8 border-t border-sand">
            <p className="text-sm italic">
              By booking and receiving services at Aura Wellness Aesthetics, you acknowledge that you have read, understood, and agree to these terms of service.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}

