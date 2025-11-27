'use client';

import { motion } from 'framer-motion';
import Section from '../_components/Section';
import Accordion from '../_components/Accordion';
import faqs from '../_content/faqs.json';

export default function FAQClient() {
  return (
    <>
      {/* Hero */}
      <Section background="sand">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto pt-8 md:pt-0"
        >
          <h1 className="text-2xl md:text-display font-serif text-charcoal mb-4 md:mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-sm md:text-lg text-warm-gray leading-relaxed">
            Common questions about booking, services, policies, and what to expect at aura aesthetics.
          </p>
        </motion.div>
      </Section>

      {/* FAQ List */}
      <Section background="ivory">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-white rounded-lg shadow-sm p-8 md:p-12 space-y-12">
            {faqs.map((section, sectionIndex) => (
              <div key={section.group}>
                <div className="mb-6 text-left">
                  <h2 className="text-h3 font-serif text-charcoal">{section.group}</h2>
                  <div className="mt-2 h-0.5 w-16 bg-dark-sage/50" />
                </div>

                <div className="space-y-4">
                  {section.faqs.map((faq, index) => (
                    <motion.div
                      key={faq.q}
                      initial={{ opacity: 1, y: 0 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: (sectionIndex * 0.1) + index * 0.05 }}
                    >
                      <Accordion question={faq.q} answer={faq.a} />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 1 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 text-center"
          >
            <p className="text-warm-gray mb-4">
              Still have questions? We&apos;re here to help.
            </p>
            <p className="text-sm text-warm-gray">
              Contact details will be available once booking opens. In the meantime, join our email list for updates.
            </p>
          </motion.div>
        </motion.div>
      </Section>
    </>
  );
}

