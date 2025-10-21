# AI Chat Agent Setup Guide

## 🎉 What's Been Added

A **Gemini AI-powered chat agent** has been integrated into your Carbon Recycling Platform! 

**Features:**
- 💬 Floating chat widget on all pages
- 🧠 Powered by Google Gemini AI (Flash model - cheapest option)
- 📚 Pre-loaded with full platform knowledge
- 💾 Conversation history within session
- 🎨 Beautiful, responsive UI
- 💡 Suggested starter questions
- ⚡ Real-time responses

**Location:** Bottom-right corner of every page (green chat bubble)

---

## 🔑 Setup Instructions

### Step 1: Get Your Free Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API Key"**
4. Click **"Create API key in new project"**
5. Copy your API key (starts with `AIza...`)

**Important:** This gives you **FREE tier access**:
- 15 requests per minute
- 1,500 requests per day  
- 1 million tokens per month
- Perfect for testing and early users!

### Step 2: Add API Key to Your Environment

1. Navigate to your web app directory:
   ```bash
   cd apps/web
   ```

2. Create/update `.env` file:
   ```bash
   # Copy from example
   cp .env.example .env
   
   # Or edit directly
   nano .env
   ```

3. Add your API key:
   ```env
   GEMINI_API_KEY=AIzaSyYourActualKeyHere
   ```

4. Save and close the file

### Step 3: Restart Your Dev Server

```bash
# Stop current server (Ctrl+C)

# Start again
npm run dev
```

### Step 4: Test It!

1. Open your browser to `http://localhost:4321`
2. Look for the **green chat bubble** in the bottom-right corner
3. Click it to open the chat
4. Try asking: **"How do I get started?"**

---

## 💰 Cost Information

### Free Tier (Perfect for Starting)

**Limits:**
- 15 requests/minute
- 1,500 requests/day
- 1,000,000 tokens/month FREE

**Real Usage Example:**
- Average conversation: ~2,500 tokens
- 1,000,000 tokens = **~400 conversations/month**
- That's ~13 conversations per day **completely FREE**

### If You Exceed Free Tier

**Gemini Flash Pricing** (Pay-as-you-go):
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

**Monthly Cost Estimates:**
- **50 conversations/day:** ~$10-15/month
- **100 conversations/day:** ~$20-30/month  
- **500 conversations/day:** ~$100-150/month

**Cost per conversation:** ~£0.001 (0.1 pence!)

---

## 📊 Monitoring Usage

### Check Your Usage

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **"APIs & Services" → "Dashboard"**
4. Click on **"Generative Language API"**
5. View usage quotas and metrics

### Set Up Billing Alerts

1. Go to **"Billing" → "Budgets & alerts"**
2. Click **"Create Budget"**
3. Set a monthly budget (e.g., £50)
4. Configure email alerts at 50%, 90%, 100%

---

## 🎨 Customization Options

### Change AI Model

Edit `apps/web/src/pages/api/chat.ts`:

```typescript
// Use Pro model (better quality, more expensive)
const model = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-pro',  // Changed from 'flash'
  // ...
});
```

**Models:**
- `gemini-1.5-flash` - Cheapest, fastest (current)
- `gemini-1.5-pro` - Better quality, ~10x more expensive

### Adjust Response Length

Edit `apps/web/src/pages/api/chat.ts`:

```typescript
generationConfig: {
  maxOutputTokens: 2048,  // Increase for longer responses
  // ...
}
```

### Update Knowledge Base

Edit `apps/web/src/data/platform-knowledge.ts` to:
- Add new features
- Update documentation
- Add more FAQs
- Change assistant personality

### Customize Widget Appearance

Edit `apps/web/src/components/ChatWidget.tsx`:
- Change colors (search for `bg-green-600`)
- Adjust size (`w-96 h-[32rem]`)
- Modify positioning (`bottom-6 right-6`)
- Change welcome message

---

## 🔧 Troubleshooting

### Chat Button Not Appearing

**Check:**
1. Dev server is running
2. ChatWidget imported in Layout.astro
3. No JavaScript errors in browser console

### "API Key Not Configured" Error

**Fix:**
1. Verify `GEMINI_API_KEY` in `.env`
2. Restart dev server after adding key
3. Check for typos in API key

### "Failed to Process Chat Message" Error

**Possible causes:**
1. Invalid API key
2. Free tier quota exceeded
3. Network connectivity issues

**Check:**
- Browser console for detailed error
- API key is active in Google AI Studio
- Usage hasn't exceeded free tier limits

### Responses Are Slow

**Normal:**
- First response: 2-4 seconds (loading model)
- Subsequent responses: 1-2 seconds

**If slower:**
- Check network connection
- Consider upgrading to Pro model
- Reduce `maxOutputTokens`

---

## 🚀 Going to Production

### 1. Environment Variables

Add `GEMINI_API_KEY` to your hosting platform:

**Vercel:**
```bash
vercel env add GEMINI_API_KEY
```

**Netlify:**
```bash
netlify env:set GEMINI_API_KEY "AIza..."
```

**Cloudflare Pages:**
- Dashboard → Pages → Settings → Environment Variables
- Add `GEMINI_API_KEY` with your key

### 2. Set Up Monitoring

- Enable billing alerts in Google Cloud
- Monitor daily usage
- Set up error tracking (Sentry already configured)

### 3. Rate Limiting (Recommended)

Consider adding rate limiting to prevent abuse:

```typescript
// In api/chat.ts
const userRequests = new Map<string, number>();

// Limit: 10 requests per minute per IP
const rateLimitCheck = (ip: string) => {
  const count = userRequests.get(ip) || 0;
  if (count > 10) throw new Error('Rate limit exceeded');
  userRequests.set(ip, count + 1);
  setTimeout(() => userRequests.delete(ip), 60000);
};
```

---

## 📈 Future Enhancements

### Potential Improvements:

1. **Conversation Persistence**
   - Store chat history in database
   - Resume conversations across sessions

2. **User Authentication Integration**
   - Personalized responses based on user data
   - Access to user's specific emissions data

3. **Advanced Features**
   - Voice input/output
   - File uploads (analyze CSV files)
   - Direct actions (trigger calculations, generate reports)

4. **Multi-language Support**
   - Detect user language
   - Respond in user's preferred language

---

## 💡 Pro Tips

1. **Start with Free Tier**
   - Test thoroughly before enabling billing
   - Monitor usage for first month
   - Adjust based on actual user behavior

2. **Optimize Costs**
   - Use Flash model for 90% of queries
   - Switch to Pro only for complex questions
   - Keep `maxOutputTokens` reasonable

3. **Improve Responses**
   - Update knowledge base regularly
   - Add real customer questions to FAQs
   - Fine-tune system prompt based on feedback

4. **User Experience**
   - Monitor response times
   - Add loading indicators
   - Provide fallback to email support
   - Show "typing" indicators

---

## 📞 Support

**Questions about the chat agent?**
- Check this guide first
- Review code comments in source files
- Contact: info@carbonrecycling.co.uk

**Gemini API Issues?**
- [Google AI Studio Documentation](https://ai.google.dev/docs)
- [Gemini API Reference](https://ai.google.dev/api/rest)
- [Community Forum](https://discuss.ai.google.dev/)

---

## ✅ Quick Start Checklist

- [ ] Get Gemini API key from Google AI Studio
- [ ] Add `GEMINI_API_KEY` to `.env` file
- [ ] Restart dev server
- [ ] Open browser and test chat
- [ ] Set up billing alerts in Google Cloud
- [ ] Monitor usage for first week
- [ ] Update knowledge base as needed

**Estimated Setup Time:** 5 minutes

**Cost to Start:** £0 (free tier)

---

**Congratulations! 🎉** 

Your platform now has an AI chat agent that can:
- Answer questions 24/7
- Guide users through features
- Reduce support tickets
- Improve user onboarding

All powered by Google's latest AI technology at minimal cost!
