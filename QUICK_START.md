# Quick Start Guide - For Amy & Reviewers

Welcome! The Aura Aesthetics website is ready for review. Here's how to see it in action.

## 🚀 View the Site Locally

The development server is already running! Open your browser and visit:

**http://localhost:3000**

You should see the home page with the hero "Skin rituals, done gently."

---

## 📱 Pages to Test

Click through each page in the navigation:

1. **Home** (`/`) - Hero, value pillars, featured services, Amy intro
2. **About** (`/about`) - Amy's bio, credentials, philosophy
3. **Services** (`/services`) - All treatments with category filter
4. **FAQ** (`/faq`) - Accordion with 10 questions
5. **Book** (`/book`) - "Coming soon" page with email capture
6. **Contact** (`/contact`) - Placeholder contact info

Also try clicking the **"Book"** button in the navigation - it should show a "Opens soon" tooltip.

---

## ✅ Things to Check

### Content
- [ ] Does the copy match the brand voice?
- [ ] Are all service descriptions accurate?
- [ ] Any typos or edits needed?
- [ ] FAQ answers complete?

### Design
- [ ] Colors feel warm and bohemian?
- [ ] Spacing feels generous and calm?
- [ ] Typography is elegant but readable?
- [ ] Gradients look thoughtful (placeholders for photos)?

### Functionality
- [ ] Navigation works smoothly
- [ ] Service category filter tabs work
- [ ] FAQ accordions expand/collapse
- [ ] Email capture form validates (try submitting empty, invalid email, etc.)
- [ ] "Book" button shows tooltip on hover
- [ ] Mobile responsive (resize browser window)

---

## 📝 Making Content Changes

### Quick Edits Without Code

1. **Update Services:**
   - Open: `app/_content/services.json`
   - Edit prices, durations, descriptions
   - Save the file
   - Refresh browser (changes appear automatically)

2. **Update FAQs:**
   - Open: `app/_content/faqs.json`
   - Edit questions or answers
   - Save and refresh

3. **Update Site Info:**
   - Open: `app/_content/site.json`
   - Add hours, location, social links
   - Save and refresh

**Pro tip:** Changes auto-reload in the browser when you save files!

---

## 🎨 Current Placeholders

These can be updated later:

- **Images:** Gradients used for Amy portrait, service cards, map
- **Prices:** All show "TBD"
- **Contact:** Location, hours, phone all say "TBD"
- **Socials:** Instagram/TikTok links empty
- **Email Capture:** Form works (validation) but doesn't save emails yet
- **Booking:** Disabled with "Opens soon" message

---

## 🛑 Stop the Server

When done reviewing:

1. Go to Terminal/Command Prompt
2. Press `Ctrl + C`
3. Server will stop

To restart:
```bash
npm run dev
```

---

## 📤 Next Steps

### If You Approve:
1. Send feedback on any content changes
2. Provide real photos (if available)
3. Finalize prices, hours, contact info
4. Ready to deploy to live site!

### If Changes Needed:
- Make a list of edits
- Share with Ariel
- Updates can be made quickly

---

## 🌐 Going Live

When ready to launch:

1. Finalize all content
2. Push to GitHub
3. Deploy to Vercel (free, takes 2 minutes)
4. Site will be live at `auraesthetics.vercel.app`
5. Can add custom domain later (e.g., `auraesthetics.com`)

See `DEPLOYMENT.md` for detailed deployment steps.

---

## 💡 Tips

- **Zoom in/out** in browser to test different text sizes
- **Try on phone** if possible (responsive design)
- **Tab through** page to test keyboard navigation
- **Take notes** on what you love or want to change

---

## ❓ Questions?

- See `PROJECT_SUMMARY.md` for complete feature list
- See `CONTENT_UPDATE_GUIDE.md` for editing instructions
- Contact Ariel with any questions or feedback

**Enjoy exploring your new site!** 🌿✨

