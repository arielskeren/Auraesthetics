'use client';

/**
 * Instagram Feed Component - FREE Options
 * 
 * Option 1: Fouita (FREE, No Signup Required - Recommended)
 * 1. Go to https://fouita.com/embed-instagram-feed-free
 * 2. Enter username: @auraesthetics
 * 3. Customize layout, columns, colors
 * 4. Copy the embed code
 * 5. Get the widget ID from the iframe src (e.g., fouita.com/widget/123456)
 * 6. Add to .env.local: NEXT_PUBLIC_INSTAGRAM_WIDGET_ID=123456
 * 7. Set: NEXT_PUBLIC_INSTAGRAM_PROVIDER=fouita
 * 
 * Option 2: EmbedSocial (FREE tier)
 * 1. Go to https://embedsocial.com/
 * 2. Create free account
 * 3. Create Instagram widget
 * 4. Get embed code and replace iframe below
 * 
 * Option 3: Elfsight (FREE tier)
 * 1. Go to https://elfsight.com/instagram-feed-widget/
 * 2. Create free account
 * 3. Create widget
 * 4. Get embed code
 */

interface InstagramFeedProps {
  provider?: 'fouita' | 'embedsocial' | 'elfsight' | 'custom';
  widgetId?: string;
  username?: string;
  embedCode?: string; // For custom embed codes
}

export default function InstagramFeed({ 
  provider,
  widgetId, 
  username = 'auraesthetics',
  embedCode
}: InstagramFeedProps) {
  // Get values from environment variables
  const envProvider = process.env.NEXT_PUBLIC_INSTAGRAM_PROVIDER as InstagramFeedProps['provider'];
  const envWidgetId = process.env.NEXT_PUBLIC_INSTAGRAM_WIDGET_ID;
  
  const finalProvider = provider || envProvider || 'fouita';
  const finalWidgetId = widgetId || envWidgetId;

  // If custom embed code is provided, use it directly
  if (embedCode) {
    return (
      <div 
        className="w-full"
        dangerouslySetInnerHTML={{ __html: embedCode }}
      />
    );
  }

  // Fouita - Free, no signup required
  if (finalProvider === 'fouita' && finalWidgetId) {
    return (
      <div className="w-full">
        <iframe
          src={`https://fouita.com/widget/${finalWidgetId}`}
          className="w-full border-0 overflow-hidden rounded-lg"
          style={{ height: '600px', minHeight: '400px' }}
          title="Instagram Feed"
          allowTransparency
          loading="lazy"
        />
      </div>
    );
  }

  // EmbedSocial - Free tier
  if (finalProvider === 'embedsocial' && finalWidgetId) {
    return (
      <div className="w-full">
        <iframe
          src={`https://embedsocial.com/api/pro_hashtag/instagram_hashtag/${finalWidgetId}`}
          className="w-full border-0 overflow-hidden rounded-lg"
          style={{ height: '600px', minHeight: '400px' }}
          title="Instagram Feed"
          allowTransparency
          loading="lazy"
        />
      </div>
    );
  }

  // Elfsight - Free tier
  if (finalProvider === 'elfsight' && finalWidgetId) {
    return (
      <div className="w-full">
        <div 
          className="elfsight-app"
          data-elfsight-app-id={finalWidgetId}
        />
        <script src="https://static.elfsight.com/platform/platform.js" async defer />
      </div>
    );
  }

  // Fallback: Simple grid with links to Instagram
  return (
    <div className="text-center">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((item, index) => (
          <a
            key={item}
            href={`https://instagram.com/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="aspect-square rounded-lg bg-gradient-to-br from-sand via-taupe/20 to-dark-sage/40 flex items-center justify-center group cursor-pointer hover:shadow-lg transition-all hover:scale-105"
          >
            <svg 
              className="w-12 h-12 text-warm-gray/40 group-hover:text-dark-sage transition-colors" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </a>
        ))}
      </div>
      <p className="text-warm-gray text-sm">
        <a 
          href={`https://instagram.com/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-dark-sage hover:underline font-medium"
        >
          Follow us on Instagram
        </a> to see treatment highlights, skincare education, and studio vibes.
      </p>
    </div>
  );
}
