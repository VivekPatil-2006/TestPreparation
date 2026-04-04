# UI Style Guide - Placement Test Platform

## Overview
This document outlines the modern, professional design system implemented for the Placement Test Platform. The design emphasizes clarity, accessibility, and user experience with contemporary UI patterns.

---

## Color Palette

### Primary Colors
- **Brand Blue**: `#0f6efd` - Main interactive elements, links, primary buttons
- **Brand Dark**: `#0b5ed7` - Button hover states, gradients
- **Brand Light**: `#e7f1ff` - Soft backgrounds, hover states

### Semantic Colors
- **Success Green**: `#16a34a` - Success messages, active status badges
- **Success Light**: `#dcfce7` - Success backgrounds
- **Danger Red**: `#dc2626` - Error messages, delete actions
- **Danger Light**: `#fee2e2` - Error backgrounds
- **Accent Teal**: `#0f766e` - Accent elements

### Neutral Colors
- **Dark**: `#0f172a` - Primary text
- **Dark Light**: `#475569` - Secondary text  
- **Muted**: `#64748b` - Disabled/placeholder text
- **Border**: `#e2e8f0` - Borders, separators
- **Border Light**: `#f1f5f9` - Subtle borders
- **Background**: `#f8fafc` - Page background
- **Background Secondary**: `#f1f5f9` - Secondary backgrounds
- **White**: `#ffffff` - Cards, overlays

---

## Typography

### Font Family
- **Primary**: Segoe UI, Trebuchet MS, system-ui, sans-serif
- **Fallback**: -apple-system, sans-serif

### Heading Sizes & Weights
- **H1**: 36px, 700 weight - Page titles
- **H2**: 24px, 700 weight - Section headers
- **H3**: 20px, 700 weight - Subsection headers
- **Labels**: 14-15px, 700 weight - Form/button labels
- **Body**: 14-16px, 400-500 weight - Content text
- **Small**: 12-13px, 500-600 weight - UI labels, captions

### Letter Spacing
- **Uppercase labels**: 0.5px letter-spacing, uppercase text-transform
- **Standard**: normal letter-spacing

---

## Spacing System

### Standard Spacing Units (px)
- `8px` - Minimal spacing
- `12px` - Compact spacing
- `16px` - Standard spacing between elements
- `20px` - Comfortable spacing
- `24px` - Generous spacing
- `32px` - Large section spacing
- `40px` - Extra large spacing

### Padding
- **Small**: 12-14px (inputs, small cards)
- **Medium**: 20-24px (cards, containers)
- **Large**: 40-48px (forms, modals)

---

## Border Radius

### Standard Radius Values
- `8px` - Small elements (buttons, inputs when compact)
- `12px` - Standard elements (cards, inputs, buttons)
- `16px` - Large elements (panels, large dropzones)
- `20px` - Extra large (modals, large cards)
- `20px` (50%) - Circular badges and pills

---

## Shadows

### Shadow Styles (CSS Custom Properties)
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
```

### Usage
- **sm**: Subtle depth for small components
- **md**: Standard cards and containers
- **lg**: Modals, dropdowns, elevated cards
- **xl**: Large modals, main overlays

---

## Buttons

### Button States

#### Primary Button (Default)
- **Background**: Linear gradient (Brand → Brand Dark)
- **Text Color**: White (#ffffff)
- **Height**: 48-52px
- **Padding**: 12px 24px
- **Border Radius**: 12px
- **Font**: 16px, 700 weight, uppercase

#### Button Hover
- **Transform**: translateY(-2px)
- **Box Shadow**: 0 12px 32px rgba(15, 110, 253, 0.35)
- **Transition**: 200ms cubic-bezier(0.4, 0, 0.2, 1)

#### Button Active
- **Transform**: translateY(0px) - returns to baseline
- **Transition**: Smooth 200ms

#### Button Disabled
- **Opacity**: 0.65
- **Cursor**: not-allowed
- **No hover effects**

### Secondary Button (Outlined)
- **Background**: Transparent
- **Border**: 2px solid Brand
- **Text Color**: Brand
- **Hover**: Background changes to Brand Light

---

## Form Elements

### Input Fields
- **Height**: 52px (comfortable touch target)
- **Padding**: 12px 14px, 50px left (with icon)
- **Border**: 2px solid Border color
- **Border Radius**: 12px
- **Background**: Light background (--bg)
- **Font Size**: 15-16px

### Input Focus State
- **Border Color**: Brand Blue
- **Background**: White (--card)
- **Box Shadow**: 0 0 0 3px rgba(15, 110, 253, 0.1)
- **Outline**: None

### Input Placeholder
- **Color**: Muted gray (#64748b)
- **Font Style**: Normal

### Select Dropdowns
- **Styling**: Same as inputs
- **Custom Arrow**: SVG gradated
- **Appearance**: None (custom styling)

---

## Cards & Containers

### Standard Card
- **Background**: White (#ffffff)
- **Border**: 1px solid Border
- **Border Radius**: 16px
- **Padding**: 24px
- **Box Shadow**: Shadow-sm
- **Hover**: Box shadow bumps to shadow-md, translateY(-2px)

### Metric Cards
- **Background**: Gradient overlay effect
- **Accent**: Icon with 20% opacity
- **Animation**: Hover lifting effect

### Panels
- **Background**: White
- **Border**: 1px solid Border
- **Border Radius**: 16px
- **Padding**: 24px
- **Multiple sections**: 24px gap between items

---

## Animations & Transitions

### Transition Timing
- **Default**: 200ms cubic-bezier(0.4, 0, 0.2, 1)
- **Fast**: 100ms
- **Slow**: 300ms

### Standard Animations
- **Hover**: Transform + shadow changes
- **Fade**: Opacity transitions
- **Slide**: TranslateY when modal/dropdown opens

### Special Animations

#### Bounce Animation (Upload Zone Icon)
```css
animation: bounce 2s infinite;
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
```

#### Pulse Animation (Timer)
```css
animation: pulse 2s infinite;
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(15, 110, 253, 0.4); }
  50% { box-shadow: 0 0 0 10px rgba(15, 110, 253, 0); }
}
```

#### Slide In Animation (Upload Results)
```css
animation: slideInUp 300ms ease-out;
@keyframes slideInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## Component-Specific Styles

### Navigation Bar
- **Sticky**: Position sticky, top 0, z-index 100
- **Backdrop**: backdrop-filter: blur(10px)
- **Background**: 95% opacity white with blur
- **Border**: 1px solid Border
- **Padding**: 14px 28px
- **Min Height**: 70px

### Active Navigation Item
- **Bottom Border**: 3px solid Brand gradient
- **Background**: Brand Light

### Topbar Brand
- **Logo**: Gradient text effect
- **Badge**: 44x44px, rounded 12px, gradient background

### Login Page
- **Background**: Gradient with animated blob effects
- **Blobs**: Radial gradients with 10% opacity
- **Card**: 480px max-width, 48px padding, 20px border-radius
- **Header**: Center aligned with 32px gap

### Dashboard Grid
- **Layout**: 3-column grid on desktop, auto-fit responsive
- **Min Column**: 280px
- **Gap**: 20px

### Progress Bar
- **Height**: 10px
- **Background**: Border color (#e2e8f0)
- **Fill**: Brand gradient with glow shadow
- **Transition**: 300ms width change

### Tables
- **Header Background**: Secondary background color
- **Header Text**: Uppercase, 700 weight, 12px
- **Border**: 2px between header/body, 1px between rows
- **Row Hover**: Background-color change, no transform
- **Cell Padding**: 16px
- **Responsive**: 12px padding on mobile

---

## Accessibility

### Color Contrast
- All text meets WCAG AA standards (4.5:1 for body text)
- Interactive elements: 4.5:1 minimum

### Focus States
- All interactive elements have visible focus ring
- Focus ring: 3px solid brand color with 10% opacity background
- No outline: none on interactive elements with custom focus states

### Touch Targets
- Minimum 44x44px for all interactive elements
- Buttons: 48-52px height minimum
- Spacing: 8-12px minimum between interactive elements

### Typography
- Line height: 1.6 for body text
- Letter spacing: 0.5px for labels to improve readability
- Font sizes: 14px minimum for body content

---

## Responsive Breakpoints

### Mobile (< 768px)
- **Grid**: Single column
- **Padding**: 16px general padding
- **Font Sizes**: Reduced by ~15-20%
- **Metric Cards**: Full width
- **Top Navigation**: Flex column, responsive
- **Form Width**: Full width with max-width container

### Tablet & Desktop (≥ 768px)
- **Grid**: Multi-column
- **Padding**: 24-32px
- **Font Sizes**: Full size
- **Layout**: Standard multi-column layouts

---

## Theme Variables (CSS Custom Properties)

### Available CSS Variables
```css
--bg: #f8fafc
--bg-secondary: #f1f5f9
--ink: #0f172a
--ink-light: #475569
--brand: #0f6efd
--brand-dark: #0b5ed7
--brand-light: #e7f1ff
--accent: #0f766e
--card: #ffffff
--danger: #dc2626
--danger-light: #fee2e2
--muted: #64748b
--border: #e2e8f0
--border-light: #f1f5f9
--success: #16a34a
--success-light: #dcfce7
--shadow-sm: (box-shadow value)
--shadow-md: (box-shadow value)
--shadow-lg: (box-shadow value)
--shadow-xl: (box-shadow value)
--transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1)
```

---

## Implementation Notes

### Font Smoothing
```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### Gradient Usage
- Use linear-gradient(135deg, ...) for diagonal direction
- Use on brand elements for visual impact
- Combine with subtle shadows for depth

### Backdrop Effects
- Use backdrop-filter: blur(10px) sparingly
- Primarily on navigation, sticky elements
- Combine with semi-transparent backgrounds

### Selection Styling
```css
*::selection {
  background: rgba(15, 110, 253, 0.3);
  color: inherit;
}
```

---

## Future Considerations

### CSS Variables
Consider adding more granular control via CSS custom properties for:
- Individual shadow values
- Border width variations
- Spacing rhythm variations

### Component Library
Create reusable styled components for:
- Buttons with variants
- Form inputs with validation states
- Cards with multiple styles
- Modal/Dialog components

### Dark Mode
Potential for CSS variables to support:
- Dark theme color overrides
- Automatic theme switching
- User preference detection

---

## Changelog

### Version 1.0 (Current)
- ✅ Modern color palette implementation
- ✅ Enhanced shadows and depth effects
- ✅ Smooth transitions and animations
- ✅ Improved typography hierarchy
- ✅ Enhanced form styling with focus states
- ✅ Modern button designs with gradients
- ✅ Professional table styling
- ✅ Animated elements (bounce, pulse)
- ✅ Responsive design improvements
- ✅ Gradient backgrounds and effects
- ✅ Better visual feedback on interactions

---

## Resources

- **CSS Reference**: App.css
- **Tailwind Config**: tailwind.config.js
- **Global Styles**: index.css
- **Component Styles**: Individual component CSS classes

