'use client';

import { motion } from 'framer-motion';
import Section from '../_components/Section';

export default function FormsClient() {
  const forms = [
    {
      title: 'New Client Intake Form',
      description: 'Required for all first-time clients. Please complete before your first appointment.',
      status: 'Coming Soon'
    },
    {
      title: 'Medical History & Consent',
      description: 'Health information and treatment consent for advanced services.',
      status: 'Coming Soon'
    },
    {
      title: 'COVID-19 Screening',
      description: 'Health screening form to ensure safety for all clients and staff.',
      status: 'Coming Soon'
    },
    {
      title: 'Photo Release Consent',
      description: 'Optional consent for before/after photos and social media sharing.',
      status: 'Coming Soon'
    },
    {
      title: 'Minor Consent Form',
      description: 'Required parental consent for clients under 18 years old.',
      status: 'Coming Soon'
    }
  ];

  return (
    <>
      {/* Hero */}
      <Section background="sand">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto pt-16 md:pt-0"
        >
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-6">
            Client Forms
          </h1>
          <p className="text-lg text-warm-gray leading-relaxed">
            Complete your intake and consent forms before your appointment for a seamless experience.
          </p>
        </motion.div>
      </Section>

      {/* Forms List */}
      <Section background="ivory">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-sage/30 border-l-4 border-sage p-6 rounded-lg mb-12">
            <p className="text-charcoal">
              <strong>Note:</strong> Online forms will be available soon. For now, please arrive 10 minutes early to your appointment to complete paperwork in-studio.
            </p>
          </div>

          <div className="space-y-6">
            {forms.map((form, index) => (
              <motion.div
                key={form.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="bg-white p-8 rounded-lg shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-h3 font-serif text-charcoal">{form.title}</h3>
                  <span className="px-4 py-1 bg-taupe/30 text-warm-gray text-sm rounded-full">
                    {form.status}
                  </span>
                </div>
                <p className="text-warm-gray leading-relaxed">{form.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* Instructions */}
      <Section background="sand">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-h2 font-serif text-charcoal mb-8 text-center">
            What to Expect
          </h2>
          
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-xl font-serif text-charcoal mb-3">Before Your Appointment</h3>
              <p className="text-warm-gray">
                Once online forms are available, you&apos;ll receive a link via email or text after booking. Complete all required forms at least 24 hours before your scheduled appointment.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-xl font-serif text-charcoal mb-3">For Your First Visit</h3>
              <p className="text-warm-gray">
                Please arrive 10-15 minutes early to complete intake paperwork and discuss your skin goals with Amy. This consultation ensures your treatment is fully customized.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-xl font-serif text-charcoal mb-3">Digital Signatures</h3>
              <p className="text-warm-gray">
                All forms will support secure electronic signatures for your convenience. Your information is kept confidential and secure.
              </p>
            </div>
          </div>
        </motion.div>
      </Section>
    </>
  );
}

