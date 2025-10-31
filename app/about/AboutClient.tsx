'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Section from '../_components/Section';

export default function AboutClient() {
  const approaches = [
    {
      title: 'Gentle by design',
      description: 'Barrier‑supportive, mindful touch that respects your skin\'s natural rhythm and resilience.'
    },
    {
      title: 'Customization',
      description: 'Each service adapts to your current skin state, not a one‑size‑fits‑all protocol.'
    },
    {
      title: 'Education',
      description: 'Clear guidance for home care that fits your life, budget, and goals.'
    }
  ];

  return (
    <>
      {/* Hero */}
      <Section background="sand" className="relative">
        {/* Decorative green line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/40 to-transparent" />
        {/* Background accents */}
        <div className="absolute top-20 right-10 w-48 h-48 bg-dark-sage/15 rounded-full blur-3xl" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto pt-16 md:pt-0"
        >
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-6">
            Meet Amy
          </h1>
          <p className="text-lg text-warm-gray leading-relaxed">
            An aesthetician who believes in calm, customized care and the beauty of slowing down.
          </p>
        </motion.div>
      </Section>

      {/* Portrait + Bio */}
      <Section background="ivory" className="relative">
        {/* Subtle green background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-dark-sage/6 via-transparent to-sage-light/8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center relative z-10">
          <motion.div
            initial={{ opacity: 1, x: 0 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="order-2 md:order-1"
          >
            <div className="aspect-[3/4] rounded-lg overflow-hidden relative shadow-lg">
              <Image
                src="/amy-photo.jpg"
                alt="Amy - Aura Wellness Aesthetics"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 1, x: 0 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="order-1 md:order-2"
          >
            <h2 className="text-h2 font-serif text-charcoal mb-6">About Amy</h2>
            <div className="space-y-4 text-warm-gray leading-relaxed">
              <p>
                Amy is an aesthetician with a calm, intuitive approach to skin health. Her studio blends modern modalities with grounded, bohemian design—soft light, natural textures, and unhurried care.
              </p>
              <p>
                Sessions are tailored to your skin&apos;s needs with ingredient‑mindful products and gentle technique. She believes that healthy skin begins with understanding what your skin actually needs, not what trends dictate.
              </p>
              <p>
                Whether you&apos;re seeking relief from sensitivity, support for aging skin, or simply a moment of deep relaxation, every treatment is designed to honor where you are right now.
              </p>
            </div>

            <div className="mt-8 p-6 bg-sand/50 rounded-lg">
              <h3 className="text-lg font-serif text-charcoal mb-3">Credentials</h3>
              <p className="text-sm text-warm-gray">
                Licensed Facial Specialist · Advanced modality training (placeholder for specific certifications)
              </p>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* Philosophy & Approach */}
      <Section background="sage" className="relative">
        {/* Decorative top line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/60 to-transparent" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-h1 font-serif text-charcoal mb-4">Philosophy & Approach</h2>
          <p className="text-warm-gray max-w-2xl mx-auto leading-relaxed">
            Rooted in skin health, guided by intuition, and delivered with care.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {approaches.map((approach, index) => (
            <motion.div
              key={approach.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white p-8 rounded-lg"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-dark-sage to-dark-sage/60 mb-6" />
              <h3 className="text-h3 font-serif text-charcoal mb-4">{approach.title}</h3>
              <p className="text-warm-gray leading-relaxed">{approach.description}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Brand Values */}
      <Section background="ivory" className="relative">
        {/* Subtle green accents */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-sage/8 via-transparent to-sage-dark/10" />
        {/* Decorative bottom line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/40 to-transparent" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-h2 font-serif text-charcoal mb-6">Care, Calm, Craft</h2>
          <p className="text-warm-gray leading-relaxed mb-6">
            These three words anchor everything at Aura Wellness Aesthetics. Care in how we listen and treat. Calm in the environment and energy. Craft in the precision and thoughtfulness of every technique.
          </p>
          <p className="text-warm-gray leading-relaxed">
            You won&apos;t be rushed. You won&apos;t be upsold. You&apos;ll receive honest guidance, skilled hands, and a space designed to help you exhale.
          </p>
        </motion.div>
      </Section>
    </>
  );
}

