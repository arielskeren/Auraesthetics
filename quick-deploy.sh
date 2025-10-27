#!/bin/bash
echo "🚀 Deploying Aura Wellness Aesthetics to Vercel..."
echo ""

# Check if .env.local exists and has real values
if grep -q "your_brevo_api_key_here" .env.local 2>/dev/null; then
    echo "⚠️  WARNING: .env.local still has placeholder values!"
    echo "   Please update it with your actual Brevo credentials."
    echo ""
fi

# Add and commit changes
echo "📝 Committing changes..."
git add .
git commit -m "Add compact email capture form and footer updates"
echo ""

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main
echo ""

echo "✅ Code pushed to GitHub!"
echo ""
echo "📋 Next steps:"
echo "   1. Go to https://vercel.com and sign in"
echo "   2. Import your GitHub repository"
echo "   3. Add environment variables (BREVO_API_KEY, BREVO_LIST_ID)"
echo "   4. Click Deploy"
echo "   5. Add your domain in Vercel"
echo "   6. Update DNS in GoDaddy"
echo ""
echo "📖 See DEPLOYMENT_STEPS.md for detailed instructions"
