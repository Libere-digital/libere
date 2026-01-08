# Multi-Subdomain Deployment Guide

## Overview
Libere menggunakan multi-subdomain architecture untuk memberikan setiap perpustakaan domain sendiri dengan direct access.

## Subdomain Structure

```
app.libere.digital          → Main platform (books, home, auth)
theroom19.libere.digital    → The Room 19 Library (langsung ke library page)
bandung.libere.digital      → Bandung City Digital Library (langsung ke library page)
block71.libere.digital      → Block 71 Indonesia (langsung ke library page)
```

## 1. Vercel Configuration

### A. Add Custom Domains to Vercel Project

1. Login ke **Vercel Dashboard**: https://vercel.com/dashboard
2. Pilih project **Libere** Anda
3. Go to **Settings** → **Domains**
4. Tambahkan domains berikut satu per satu:

```
app.libere.digital
theroom19.libere.digital
bandung.libere.digital
block71.libere.digital
```

5. Klik **Add** untuk setiap domain
6. Vercel akan memberikan **CNAME** records yang perlu Anda tambahkan di Cloudflare

**Expected Vercel CNAME Record:**
```
Type: CNAME
Name: [subdomain]
Value: cname.vercel-dns.com
```

### B. Set Primary Domain (Optional)

Pilih `app.libere.digital` sebagai primary domain untuk production deployment.

---

## 2. Cloudflare DNS Configuration

### A. Login to Cloudflare

1. Go to https://dash.cloudflare.com
2. Pilih domain **libere.digital**
3. Go to **DNS** → **Records**

### B. Add DNS Records

Tambahkan **4 CNAME records** untuk setiap subdomain:

#### Record 1: App Subdomain (Main Platform)
```
Type: CNAME
Name: app
Target: cname.vercel-dns.com
Proxy status: Proxied (orange cloud)
TTL: Auto
```

#### Record 2: The Room 19 Subdomain
```
Type: CNAME
Name: theroom19
Target: cname.vercel-dns.com
Proxy status: Proxied (orange cloud)
TTL: Auto
```

#### Record 3: Bandung Subdomain
```
Type: CNAME
Name: bandung
Target: cname.vercel-dns.com
Proxy status: Proxied (orange cloud)
TTL: Auto
```

#### Record 4: Block 71 Subdomain
```
Type: CNAME
Name: block71
Target: cname.vercel-dns.com
Proxy status: Proxied (orange cloud)
TTL: Auto
```

### C. SSL/TLS Configuration

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to **Full (strict)**
3. Vercel akan otomatis provision SSL certificate untuk semua subdomain

---

## 3. Verify DNS Propagation

Setelah menambahkan DNS records, tunggu propagasi DNS (biasanya 5-15 menit):

```bash
# Check DNS propagation
nslookup app.libere.digital
nslookup theroom19.libere.digital
nslookup bandung.libere.digital
nslookup block71.libere.digital

# Or use online tool
# https://dnschecker.org
```

Expected result: All subdomains should resolve to Vercel's IP addresses.

---

## 4. Testing Subdomain Routing

### Test Each Subdomain:

1. **Main Platform** (app.libere.digital)
   ```
   https://app.libere.digital
   → Should show: Home page with all books

   https://app.libere.digital/books
   → Should show: Books list page

   https://app.libere.digital/libraries
   → Should show: Libraries list page
   ```

2. **The Room 19** (theroom19.libere.digital)
   ```
   https://theroom19.libere.digital
   → Should redirect to: https://theroom19.libere.digital/libraries/theroom19
   → Should show: The Room 19 library detail page with black/white theme
   ```

3. **Bandung** (bandung.libere.digital)
   ```
   https://bandung.libere.digital
   → Should redirect to: https://bandung.libere.digital/libraries/bandung
   → Should show: Bandung library detail page with amber theme and carousel
   ```

4. **Block 71** (block71.libere.digital)
   ```
   https://block71.libere.digital
   → Should redirect to: https://block71.libere.digital/libraries/block71
   → Should show: Block 71 library detail page with blue/teal theme and insights
   ```

---

## 5. Build & Deploy

### A. Push Changes to Git

```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: add multi-subdomain support for libraries

- Add subdomain utility for library routing
- Add SubdomainRouter component for automatic redirects
- Configure app.libere.digital as main platform
- Configure library subdomains (theroom19, bandung, block71)
- Update routing logic for direct subdomain access"

# Push to main branch (Vercel auto-deploys from main)
git push origin main
```

### B. Monitor Vercel Deployment

1. Vercel akan otomatis trigger deployment
2. Check deployment progress di Vercel Dashboard
3. Tunggu hingga status **Ready**

### C. Check Deployment Logs

Jika ada error, check deployment logs:
- Vercel Dashboard → Deployments → [Latest deployment] → View function logs

---

## 6. Environment Variables (if needed)

Jika ada environment variables yang perlu di-set untuk production:

1. Vercel Dashboard → Settings → Environment Variables
2. Add variable:
   ```
   Name: VITE_MAIN_DOMAIN
   Value: libere.digital
   ```

---

## 7. Post-Deployment Checklist

- [ ] `app.libere.digital` accessible dan menampilkan homepage
- [ ] `theroom19.libere.digital` redirect ke library page dengan tema hitam/putih
- [ ] `bandung.libere.digital` redirect ke library page dengan tema amber + carousel
- [ ] `block71.libere.digital` redirect ke library page dengan tema teal + insights
- [ ] SSL certificates active untuk semua subdomains (https:// works)
- [ ] No console errors pada browser devtools
- [ ] Borrow/return functionality tetap berfungsi di semua library subdomains
- [ ] Meta tags dan SEO canonical URLs correct untuk setiap subdomain

---

## 8. Troubleshooting

### Issue: Subdomain tidak bisa diakses (404)

**Solusi:**
1. Check DNS records di Cloudflare (pastikan CNAME pointing ke `cname.vercel-dns.com`)
2. Check domain configuration di Vercel Settings → Domains
3. Tunggu DNS propagation (up to 48 hours, biasanya 5-15 menit)

### Issue: SSL Certificate Error

**Solusi:**
1. Cloudflare SSL/TLS mode harus **Full (strict)**
2. Vercel otomatis provision SSL, tunggu beberapa menit
3. Try hard refresh (Ctrl+Shift+R atau Cmd+Shift+R)

### Issue: Redirect loop

**Solusi:**
1. Check Cloudflare Page Rules - jangan ada conflicting redirects
2. Check Cloudflare SSL/TLS mode (harus Full strict, bukan Flexible)
3. Clear browser cache dan cookies

### Issue: Library page tidak load dengan benar

**Solusi:**
1. Check browser console untuk JavaScript errors
2. Verify `SubdomainRouter.tsx` is correctly integrated in `main.tsx`
3. Check Vercel function logs untuk server-side errors

---

## 9. Next Steps (Optional Enhancements)

### A. Add WWW Redirect
Redirect `www.libere.digital` → `app.libere.digital`:

**Cloudflare Page Rule:**
```
URL: www.libere.digital/*
Setting: Forwarding URL (301 Permanent Redirect)
Destination: https://app.libere.digital/$1
```

### B. Analytics & Monitoring
- Add Vercel Analytics untuk track subdomain traffic
- Setup Cloudflare Web Analytics per subdomain
- Monitor Core Web Vitals untuk setiap library

### C. SEO Optimization
- Add sitemap.xml dengan semua subdomain URLs
- Submit subdomains ke Google Search Console
- Add structured data (JSON-LD) untuk library pages

---

## 10. Domain Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  libere.digital                      │
│                  (DNS: Cloudflare)                   │
└──────────────────────┬──────────────────────────────┘
                       │
           ┌───────────┴───────────┐
           │                       │
    ┌──────▼──────┐        ┌──────▼──────────────┐
    │ app         │        │ Library Subdomains  │
    │ (Main)      │        │                     │
    └──────┬──────┘        └──────┬──────────────┘
           │                      │
           │              ┌───────┴────────┐
           │              │                │
    ┌──────▼──────┐  ┌───▼────┐  ┌───────▼─────┐  ┌───────▼────┐
    │ Books       │  │theroom19│  │  bandung    │  │  block71   │
    │ Home        │  │         │  │             │  │            │
    │ Auth        │  │ Direct  │  │  Direct     │  │  Direct    │
    │ Libraries   │  │ Access  │  │  Access     │  │  Access    │
    └─────────────┘  └─────────┘  └─────────────┘  └────────────┘
                           │              │              │
                           ▼              ▼              ▼
                     /libraries/   /libraries/    /libraries/
                      theroom19      bandung        block71
```

---

## Support

Jika mengalami issues atau butuh bantuan:
1. Check Vercel deployment logs
2. Check Cloudflare analytics untuk DNS resolution errors
3. Review browser console untuk client-side errors
4. Contact Vercel support untuk domain configuration issues

**Deployment Date:** [To be filled after deployment]
**Last Updated:** January 8, 2026
