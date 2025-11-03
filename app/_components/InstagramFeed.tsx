'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface InstagramPost {
  id: string;
  media_url: string;
  media_type: string;
  permalink: string;
  caption?: string;
  timestamp: string;
  thumbnail_url?: string;
}

export default function InstagramFeed() {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInstagramPosts() {
      try {
        const response = await fetch('/api/instagram');
        
        if (!response.ok) {
          throw new Error('Failed to fetch Instagram posts');
        }

        const data = await response.json();
        
        if (data.posts && Array.isArray(data.posts)) {
          setPosts(data.posts);
        } else if (data.error) {
          setError(data.error);
        }
      } catch (err) {
        console.error('Error fetching Instagram posts:', err);
        setError('Unable to load Instagram feed');
      } finally {
        setLoading(false);
      }
    }

    fetchInstagramPosts();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
          <div
            key={item}
            className="aspect-square rounded-lg bg-gradient-to-br from-sand via-taupe/20 to-dark-sage/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error || posts.length === 0) {
    return (
      <div className="text-center">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="aspect-square rounded-lg bg-gradient-to-br from-sand via-taupe/20 to-dark-sage/40 flex items-center justify-center group cursor-pointer hover:shadow-lg transition-shadow"
            >
              <svg 
                className="w-12 h-12 text-warm-gray/40 group-hover:text-dark-sage transition-colors" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </motion.div>
          ))}
        </div>
        <p className="text-warm-gray text-sm">
          {error || 'Instagram feed coming soon! Follow us to see treatment highlights, skincare education, and studio vibes.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {posts.slice(0, 8).map((post, index) => (
        <motion.a
          key={post.id}
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          whileHover={{ scale: 1.05 }}
          className="aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-sand via-taupe/20 to-dark-sage/40 group cursor-pointer hover:shadow-xl transition-all relative"
        >
          {post.media_type === 'VIDEO' && post.thumbnail_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.thumbnail_url}
                alt={post.caption || 'Instagram post'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-charcoal/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </>
          ) : (
            <Image
              src={post.media_url}
              alt={post.caption || 'Instagram post'}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-300"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          )}
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            {post.caption && (
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-xs line-clamp-2">
                {post.caption}
              </div>
            )}
          </div>
        </motion.a>
      ))}
    </div>
  );
}

