# 🎨 Quick UI Reference Guide

## Fast Navigation

### Color Quick Lookup
```css
Primary Actions: #0f6efd (--brand)
Hover/Accent: #0b5ed7 (--brand-dark) or #e7f1ff (--brand-light)
Success: #16a34a (--success)
Error: #dc2626 (--danger)
Text: #0f172a (--ink) or #475569 (--ink-light)
Disabled Text: #64748b (--muted)
Borders: #e2e8f0 (--border)
```

### Spacing Quick Lookup
```css
Minimal Gap: 8px
Compact Gap: 12px
Standard Gap: 16px
Comfortable Gap: 20px
Generous Gap: 24px
Large Space: 32px
Extra Large: 40px
```

### Border Radius Quick Lookup
```css
Small Elements: 8px
Standard (buttons, inputs): 12px
Cards & Containers: 16px
Large Modals: 20px
Circular/Badges: 50%
```

### Shadow Quick Lookup
```css
Subtle Depth: var(--shadow-sm)
Standard Elevation: var(--shadow-md)
Modal/Dropdown: var(--shadow-lg)
Large Modal: var(--shadow-xl)
```

---

## Common Component Patterns

### Button with Gradient
```html
<button type="button">Submit</button>
```
✨ **Automatically styled** with:
- Gradient background (Brand → Brand Dark)
- White text
- 48-52px height
- 12px rounded corners
- Hover: translateY(-2px) + glow shadow
- Active: returns to baseline

### Form Input
```html
<input type="email" placeholder="Enter email" />
```
✨ **Includes**:
- 52px height
- 2px border (Border color)
- 12px rounded corners
- Light background
- Focus: Brand blue border + glow effect

### Card Container
```html
<div class="panel-card">
  <h2>Dashboard</h2>
  <p>Your content here</p>
</div>
```
✨ **Provides**:
- White background
- 1px border
- 16px rounded corners
- 24px padding
- Shadow depth
- Hover: elevation and lift effect

### Metric Card
```html
<div class="metric-card metric-card-dashboard">
  <div class="metric-icon">📊</div>
  <p>Total Tables</p>
  <strong>42</strong>
  <span>+2 this week</span>
</div>
```
✨ **Features**:
- Gradient background effect
- Icon backdrop
- Numeric hierarchy
- Status/change indicator

### Status Badge
```html
<span class="status-pill">active</span>
```
✨ **Provides**:
- Colored background (Success light)
- Matching text color
- Rounded all sides (20px)
- Hover scale effect

### Progress Bar
```html
<div class="progress-track">
  <div class="progress-fill" style="width: 65%"></div>
</div>
```
✨ **Includes**:
- 10px height
- Gradient fill
- Glowing shadow effect
- Smooth transitions

### Upload Dropzone
```html
<div class="upload-dropzone">
  <div class="upload-dropzone-center">
    <div class="upload-dropzone-icon">📤</div>
    <h3>Drop files here</h3>
    <p>or click to browse</p>
  </div>
</div>
```
✨ **Features**:
- Dashed border animation
- Bouncing icon
- Drag state feedback
- Responsive sizing

### Question Card (Test)
```html
<div class="question-box">
  <h3>Question Text Here</h3>
  <div class="option-list">
    <label class="option-item">
      <input type="radio" name="q1" />
      <span>Option A</span>
    </label>
    <!-- More options -->
  </div>
</div>
```
✨ **Provides**:
- Card styling
- Option hover effects
- Radio alignment
- Proper spacing

### Timer Chip
```html
<div class="timer-chip">⏱️ 28:45</div>
```
✨ **Features**:
- Pulsing animation (2s)
- Brand color with light background
- Border highlight
- Urgency indicator

---

## Layout Patterns

### Page Layout
```html
<div class="app-shell">
  <div class="portal-topbar">
    <!-- Navigation -->
  </div>
  <div class="content-area">
    <section class="upload-page">
      <!-- Page specific content -->
    </section>
  </div>
</div>
```

### Dashboard Grid
```html
<div class="dashboard-grid">
  <div class="metric-card">...</div>
  <div class="metric-card">...</div>
  <!-- Auto-responsive to single column on mobile -->
</div>
```

### Form Layout
```html
<form class="test-setup-form">
  <div>
    <label class="test-setup-label">Select Table</label>
    <select class="test-setup-select">
      <option>...</option>
    </select>
  </div>
  <div class="test-setup-details">
    <p class="test-detail-row">
      <span class="test-detail-label">Duration:</span>
      <span class="test-detail-value">30 minutes</span>
    </p>
  </div>
  <button class="test-setup-button">Start Test</button>
</form>
```

---

## Animation Quick Reference

### Hover Effects
All buttons and cards have:
```css
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
```
On hover:
```css
transform: translateY(-2px);
box-shadow: 0 12px 32px rgba(15, 110, 253, 0.35);
```

### Upload Zone Animation
```css
animation: bounce 2s infinite;
```
Icon moves up/down subtly

### Timer Pulsing
```css
animation: pulse 2s infinite;
```
Box-shadow expands outward

### Success Slide
```css
animation: slideInUp 300ms ease-out;
```
Content slides up from bottom

---

## Responsive Breakpoints

### Desktop (768px+)
- Full spacing and sizing
- Multi-column layouts
- All features visible

### Mobile (<768px)
- Single column layouts
- Reduced padding
- Touch-optimized buttons
- Simplified navigation

---

## CSS Variable Usage

### In Custom CSS
```css
.my-element {
  color: var(--ink);
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  transition: var(--transition);
}

.my-element:hover {
  border-color: var(--brand);
  box-shadow: var(--shadow-lg);
}
```

---

## Common Tweaks

### Change Primary Brand Color
Update in `App.css`:
```css
--brand: #0f6efd;      /* Change this */
--brand-dark: #0b5ed7; /* And this */
--brand-light: #e7f1ff; /* And this */
```

### Adjust Spacing
Modify base spacing (10px or 12px instead of 8px):
- Update `dashboard-grid gap`
- Update card `padding`
- Update responsive `padding`

### Modify Animation Speed
Change `--transition` duration:
```css
--transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1); /* Slower */
--transition: all 100ms cubic-bezier(0.4, 0, 0.2, 1); /* Faster */
```

### Add Dark Mode
1. Create dark mode CSS variables
2. Duplicate color values with different hex codes
3. Use media query: `@media (prefers-color-scheme: dark)`
4. Or use JS to toggle theme class

---

## Accessibility Checklist

- ✅ Color contrast > 4.5:1
- ✅ Focus rings visible (3px glow)
- ✅ Touch targets > 44x44px
- ✅ Font sizes ≥ 14px
- ✅ Line height ≥ 1.6
- ✅ Proper semantic elements
- ✅ Error messages clear
- ✅ Loading states indicated

---

## Performance Tips

1. **Use CSS variables** - Avoid repeating values
2. **Batch transforms** - Combine with shadows
3. **Prefer transitions** - Over animations when possible
4. **Hardware acceleration** - Transforms use GPU
5. **Minimal reflow** - Avoid layout recalculations

---

## Troubleshooting

### Button not styled?
- Check: Using `<button>` tag (not `<a>` or `<div>`)
- Solution: Add `button` class if needed

### Input focus ring missing?
- Check: Custom styles overriding `:focus`
- Solution: Use `box-shadow` for custom focus

### Mobile layout broken?
- Check: Grid template columns for mobile
- Solution: Verify media query breakpoint (768px)

### Animation stuttering?
- Check: Too many animations simultaneously
- Solution: Stagger animations with delays

### Colors not matching?
- Check: CSS variables loaded
- Solution: Verify `App.css` is imported first

---

## File Locations

| Purpose | File |
|---------|------|
| Main Styles | `src/App.css` |
| Global | `src/index.css` |
| Tailwind Config | `tailwind.config.js` |
| Full Guide | `UI_STYLE_GUIDE.md` |
| Enhancements | `UI_ENHANCEMENTS.md` |
| This File | `UI_QUICK_REFERENCE.md` |

---

## Need More Help?

1. **Design System Details** → See `UI_STYLE_GUIDE.md`
2. **What Changed** → See `UI_ENHANCEMENTS.md`
3. **CSS Variables** → Check `:root` in `App.css`
4. **Component Examples** → Check component CSS classes
5. **Responsive** → Check `@media` queries in `App.css`

---

**Last Updated**: April 2026
**Version**: 1.0
**Maintained By**: Design System Team

