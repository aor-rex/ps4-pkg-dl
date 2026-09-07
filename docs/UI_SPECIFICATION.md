# PS4 PKG Downloader — Complete UI Specification

This document is a **standalone UI design specification** for building the frontend of a PS4 PKG Downloader desktop application. It can be used independently with any UI builder tool (Google Stitch, Figma, hand-coded, etc.) and describes every screen, component, layout, color, interaction, and state in exhaustive detail.

---

## 1. DESIGN SYSTEM

### 1.1 Theme & Visual Identity
- **Design Philosophy**: Steam-inspired dark theme. Professional, flat, functional. NO gradients, NO glassmorphism, NO AI-generic aesthetics. Clean lines, subtle borders, purposeful contrast.
- **Primary Background**: `#1b2838` (deep navy charcoal)
- **Secondary Background / Panels**: `#1e2a3a` (slightly lighter panel surfaces)
- **Tertiary Background / Cards**: `#2a475e` (medium blue-gray for cards and elevated surfaces)
- **Accent / Primary Action**: `#66c0f4` (bright cyan-blue for buttons, links, highlights, progress bars)
- **Accent Hover**: `#4ba3d4` (darker cyan for hover states on accent elements)
- **Text Primary**: `#ffffff` (white for headings, titles, important text)
- **Text Secondary**: `#c7d5e0` (light gray for descriptions, secondary info, labels)
- **Text Muted**: `#8f98a0` (dimmed gray for disabled text, timestamps, placeholders)
- **Border / Divider**: `#3a5068` (subtle blue-gray borders between sections)
- **Success / Online**: `#4caf50` (green for completed downloads, available mirrors)
- **Warning / Partially Available**: `#ff9800` (orange/yellow for queued, mirrors with issues)
- **Error / Failed**: `#f44336` (red for failed downloads, dead mirrors, errors)
- **Focus Ring**: `#66c0f4` with 2px outer glow for keyboard accessibility

### 1.2 Typography
- **Font Family**: System default sans-serif stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Font Weight**: 400 (body), 500 (labels), 600 (card titles), 700 (headings, navigation)
- **Font Sizes**:
  - H1 (Page Title): 28px
  - H2 (Section Title): 22px
  - H3 (Card Title): 16px
  - Body: 14px
  - Small / Meta: 12px
  - Micro / Labels: 11px

### 1.3 Spacing Scale (8px grid)
- `xs`: 4px
- `sm`: 8px
- `md`: 16px
- `lg`: 24px
- `xl`: 32px
- `xxl`: 48px

### 1.4 Border Radius
- Buttons, inputs, chips: `4px`
- Cards, panels: `6px`
- Modal dialogs: `8px`
- Avatars/thumbnails: `4px` (not circular)

### 1.5 Shadows
- **Card hover shadow**: `0 4px 12px rgba(0,0,0,0.4)`
- **Modal overlay shadow**: `0 8px 32px rgba(0,0,0,0.6)`
- **Dropdown shadow**: `0 2px 8px rgba(0,0,0,0.3)`
- No elevation on flat surfaces — only cards on hover, modals, and dropdowns get shadows

### 1.6 Transitions & Animations
- **All transitions**: `0.2s ease`
- **Card hover scale**: `transform: scale(1.02)`
- **Progress bar animation**: smooth fill, no pulse effects
- **Modal open/close**: fade in/out 0.2s, slight upward slide (10px)
- **Tab switching**: underline slides to active tab 0.2s
- **No bouncing, no floating, no shimmering, no gradient animations**

---

## 2. LAYOUT STRUCTURE

### 2.1 Overall App Layout

```
┌────────────────────────────────────────────────────────────┐
│  [HEADER / TOP NAVIGATION BAR — Fixed, 56px height]        │
├──────────┬─────────────────────────────────────────────────┤
│          │                                                  │
│ SIDEBAR  │              MAIN CONTENT AREA                   │
│ 240px    │                                                  │
│ fixed    │  (Game Grid / Game Detail / Downloads / Settings)│
│          │                                                  │
│          │                                                  │
├──────────┴─────────────────────────────────────────────────┤
│  [BOTTOM BAR / DOWNLOAD MANAGER SLIDE-UP — 48px collapsed] │
│  (Expands to 320px when opened)                            │
└────────────────────────────────────────────────────────────┘
```

- The app window is a standard desktop application window, minimum size `1024x600`
- Default size: `1280x800`
- Resizable by user
- All panels adapt to window size (responsive)

---

## 3. TOP NAVIGATION BAR

**Position**: Fixed at top, full width, `56px` height  
**Background**: `#171d25` (slightly darker than main bg to differentiate)  
**Border-bottom**: `1px solid #3a5068`  
**Z-index**: `100`

### 3.1 Layout (left to right)

```
[Logo + App Name]     [Search Bar — centered, flexible width]     [⚙️ Settings] [📥 Downloads (badge)]
```

### 3.2 Logo Area (Left)
- **Width**: `200px` (aligned with sidebar width)
- **Icon**: Gamepad/controller SVG icon, `20x20px`, color `#66c0f4`
- **Text**: "PS4 PKG DL", font-weight 700, `16px`, color `#ffffff`
- **Padding**: `0 16px` horizontal
- **Hover**: cursor pointer, no visual change
- **Click**: navigates to Home / game grid view

### 3.3 Search Bar (Center)
- **Type**: Text input with search icon
- **Width**: Flexible, takes available space, max `480px`, min `240px`
- **Height**: `36px`
- **Background**: `#2a475e`
- **Border**: `1px solid #3a5068`
- **Border-radius**: `4px`
- **Placeholder text**: "Search PS4 games...", color `#8f98a0`, `14px`
- **Search icon**: Magnifying glass SVG, `16x16px`, color `#8f98a0`, positioned left inside input, `8px` from edge
- **Input text**: `14px`, color `#ffffff`, padding-left `32px`
- **Focus state**: border changes to `#66c0f4`, subtle glow `0 0 0 2px rgba(102,192,244,0.3)`
- **Clear button**: "X" icon, appears when text is typed, right side, `16x16px`, color `#8f98a0`, hover turns `#ffffff`
- **Results dropdown**: Appears below search bar when typing, shows up to 5 matching games with thumbnail, title, size — each row `48px` height, hover `#2a475e`

### 3.4 Settings Button (Right)
- **Icon**: Gear/cog SVG, `20x20px`, color `#8f98a0`
- **Hover**: color changes to `#66c0f4`, background `rgba(102,192,244,0.1)` rounded rect
- **Click**: opens Settings view in main content area

### 3.5 Downloads Button (Right)
- **Icon**: Downward arrow SVG, `20x20px`, color `#8f98a0`
- **Badge**: Red circle with white number, `16x16px`, positioned top-right of icon, font `10px` bold, shows count of active downloads
- **Badge hidden** when count is 0
- **Hover**: same as Settings button
- **Click**: toggles the Download Manager slide-up panel at bottom

---

## 4. SIDEBAR

**Position**: Fixed left side, below top nav, `240px` width, full remaining height  
**Background**: `#171d25` (same as top nav)  
**Border-right**: `1px solid #3a5068`  
**Overflow-y**: `auto` (scrollable if content exceeds height)  
**Padding**: `16px 0`

### 4.1 Sections (top to bottom)

#### 4.1.1 Navigation Items
Each item is a row:
- **Height**: `40px`
- **Padding**: `0 16px`
- **Icon**: `18x18px` SVG, left side
- **Text**: `14px`, `500` weight, left of icon with `12px` gap
- **Hover**: background `rgba(102,192,244,0.08)`, text `#66c0f4`
- **Active**: background `rgba(102,192,244,0.15)`, text `#66c0f4`, left border `3px solid #66c0f4`
- **Click**: navigates to corresponding view

**Items:**
| Icon | Label | View |
|------|-------|------|
| 🏠 Home | Home | Game grid |
| 🔥 Trending | Trending | Games sorted by popularity |
| 🆕 New | New Releases | Recently added games |
| 📂 All Games | All Games | Full catalog with pagination |

#### 4.1.2 Divider
- **Height**: `1px`
- **Background**: `#3a5068`
- **Margin**: `12px 16px`

#### 4.1.3 Genre Categories
- **Section label**: "GENRES", `11px`, `#8f98a0`, uppercase, `letter-spacing: 1px`, `padding: 0 16px 8px`
- Each genre is a text link row:
  - **Height**: `32px`
  - **Padding**: `0 16px`
  - **Text**: `14px`, color `#c7d5e0`
  - **Hover**: color `#66c0f4`, background `rgba(102,192,244,0.08)`
  - **Active**: color `#66c0f4`, font-weight `600`
  - **Click**: filters game grid by genre
- **Genres list**: Action, Adventure, RPG, Racing, Sports, Strategy, Fighting, Horror, Puzzle, Platformer, Open World, Indie
- **"Show more"**: If > 12 genres, show "+ 4 more" link that expands the list

#### 4.1.3 Divider
- Same as above

#### 4.1.4 Downloads Quick View
- **Section label**: "ACTIVE DOWNLOADS", `11px`, `#8f98a0`, uppercase, `padding: 0 16px 8px`
- Each active download shows:
  - **Height**: `48px`
  - **Padding**: `0 16px`
  - **Title**: truncated game name, `13px`, `#ffffff`, line-clamp 1
  - **Progress text**: "45%", `11px`, `#8f98a0`, right-aligned
  - **Mini progress bar**: full width minus title, `4px` height, background `#1b2838`, fill `#66c0f4`
  - **Hover**: background `rgba(102,192,244,0.08)`, cursor pointer
  - **Click**: expands the bottom download manager panel
- **Max shown**: 3 items. If more, show "+ 2 more" text, `12px`, `#8f98a0`, clickable
- **Empty state**: "No active downloads", `13px`, `#8f98a0`, centered, `padding: 16px`

---

## 5. MAIN CONTENT AREA

**Position**: Right of sidebar, below top nav, fills remaining space  
**Background**: `#1b2838`  
**Padding**: `24px`  
**Overflow-y**: `auto`

### 5.1 Views

The main content area displays ONE of these views at a time:
1. **Game Grid (Home / Browse)**
2. **Game Detail**
3. **Downloads Manager (full view)**
4. **Settings**

---

## 6. VIEW: GAME GRID (HOME)

### 6.1 Header Section
```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  Browse PS4 Games                                         │
│  Showing 1–24 of 348 games                                │
│                                                           │
│  Sort: [ Newest ▼ ]  View: [▦ Grid] [☰ List]             │
│                                                           │
└───────────────────────────────────────────────────────────┘
```
- **Title**: "Browse PS4 Games", `28px`, `700`, `#ffffff`
- **Subtitle**: "Showing 1–24 of 348 games", `14px`, `#8f98a0`, margin-top `4px`
- **Sort dropdown**: `14px`, `#c7d5e0`, background `#2a475e`, border `1px solid #3a5068`, border-radius `4px`, height `32px`, padding `0 12px`
  - Options: Newest, Oldest, Name A-Z, Name Z-A, Largest, Smallest
- **View toggle**: Two icon buttons — Grid (▦) and List (☰), `20x20px`, color `#8f98a0`, active state color `#66c0f4`, background `rgba(102,192,244,0.1)`
- **Alignment**: Title left, sort+view right, flex-row space-between

### 6.2 Game Cards — Grid View

**Grid Layout**:
- Responsive columns based on window width
- Card width: `220px` fixed
- Gap: `16px` horizontal and vertical
- Cards auto-wrap to next row
- On small windows (< 800px main content): 3 columns
- On medium (800-1100px): 4 columns
- On large (> 1100px): 5 columns

**Single Card Structure**:
```
┌─────────────────────┐
│                     │
│                     │
│   Cover Image       │
│   220 x 310px       │
│   (7:10 ratio)      │
│                     │
│                     │
├─────────────────────┤
│  Game Title         │
│  PS4 | 45.2 GB      │
└─────────────────────┘
```

**Card Details**:
- **Width**: `220px`
- **Total height**: `~380px` (image `310px` + info section `70px`)
- **Background**: `#2a475e`
- **Border-radius**: `6px`
- **Overflow**: hidden
- **Transition**: `transform 0.2s ease, box-shadow 0.2s ease`

**Cover Image Area**:
- **Width**: `220px`, **Height**: `310px`
- **Object-fit**: `cover`
- **Background while loading**: `#1b2838`
- **Placeholder if no image**: `#2a475e` with centered gamepad icon `48x48px`, color `#3a5068`
- **Hover overlay**: On card hover, a semi-transparent black overlay `rgba(0,0,0,0.5)` appears over the image with a centered "⬇️ Download" button:
  - Button background: `#66c0f4`
  - Text: "Download", `13px`, `700`, color `#1b2838`
  - Padding: `8px 20px`
  - Border-radius: `4px`

**Info Section** (below image):
- **Padding**: `12px`
- **Game title**: `14px`, `600`, `#ffffff`, line-clamp 2 lines, line-height `1.3`
- **Meta row**: `12px`, `#8f98a0`, margin-top `4px`
  - Format: `PS4 | 45.2 GB`
  - Separator: `|` with `4px` margin each side
- **Region badge** (optional): Small text badge `US`, `EU`, `JP`, etc., `10px`, padding `2px 6px`, background `rgba(102,192,244,0.15)`, color `#66c0f4`, border-radius `3px`, margin-top `4px`, inline with meta or on next line

**Card Hover State**:
- `transform: scale(1.02)`
- `box-shadow: 0 4px 12px rgba(0,0,0,0.4)`
- Cover image gets overlay with Download button

**Card Click**:
- Clicking anywhere on card navigates to Game Detail view

### 6.3 Game Cards — List View

**Layout**:
- Cards stack vertically, full width
- Each card is a horizontal row

```
┌──────────────────────────────────────────────────────────┐
│  ┌──────┐                                                │
│  │      │  Game Title                                    │
│  │Cover │  PS4 | Action | 45.2 GB                       │
│  │ img  │                        [⬇️ Download] [ℹ️ Info] │
│  └──────┘                                                │
├──────────────────────────────────────────────────────────┤
│  (divider line #3a5068, 1px)                             │
└──────────────────────────────────────────────────────────┘
```

**Card Details (List)**:
- **Height**: `80px`
- **Cover thumbnail**: `60x80px` (fills card height), left side, object-fit cover
- **Padding**: `0 16px`
- **Title**: `16px`, `600`, `#ffffff`
- **Meta**: `13px`, `#8f98a0`, margin-top `4px`
  - Format: `PS4 | Action | 45.2 GB`
- **Action buttons**: Right-aligned
  - "Download" button: `#66c0f4` background, `#1b2838` text, `13px`, `600`, padding `8px 16px`, border-radius `4px`
  - "Info" button: transparent, border `1px solid #3a5068`, color `#c7d5e0`, padding `8px 12px`, border-radius `4px`
  - Gap between buttons: `8px`
- **Hover**: background `rgba(102,192,244,0.05)`

### 6.4 Pagination

```
              ← Previous   1  2  3  ...  15   Next →
```

- **Position**: Centered below grid, margin-top `32px`
- **Page numbers**: `14px`, color `#c7d5e0`, padding `8px 12px`, border-radius `4px`
- **Active page**: background `#66c0f4`, color `#1b2838`, font-weight `600`
- **Hover**: background `rgba(102,192,244,0.15)`, color `#66c0f4`
- **Previous/Next**: `14px`, color `#8f98a0`, same padding, disabled if at first/last page (color `#3a5068`)
- **Ellipsis**: `...` for skipped pages, `14px`, color `#8f98a0`

### 6.5 Loading State (Grid)
- While scraping/loading, show skeleton cards
- **Skeleton**: `#2a475e` background with animated shimmer overlay (subtle, `#3a5068` to `#2a475e`, diagonal, 1.5s loop)
- Same dimensions as real cards
- Show 12 skeleton cards in grid pattern

### 6.6 Empty State (No Results)
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                      🎮                                  │
│                                                          │
│                   No games found                         │
│                                                          │
│          Try adjusting your search or filters            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```
- **Icon**: Gamepad SVG, `64x64px`, color `#3a5068`, centered
- **Title**: "No games found", `20px`, `600`, `#c7d5e0`, centered
- **Subtitle**: "Try adjusting your search or filters", `14px`, `#8f98a0`, centered
- **Padding**: `80px 0`

---

## 7. VIEW: GAME DETAIL

### 7.1 Top Bar
```
← Back to Browse
```
- **Button**: Left-aligned, margin-top `0`, margin-bottom `16px`
- **Icon**: Left arrow `16x16px`, color `#66c0f4`
- **Text**: "Back to Browse", `14px`, color `#66c0f4`
- **Hover**: underline text-decoration
- **Click**: navigates back to Game Grid view

### 7.2 Hero Section

```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  ┌──────────┐                                             │
│  │          │  **God of War**                             │
│  │          │  PS4 | Action, Adventure | Region: US       │
│  │  Cover   │  Size: 45.2 GB | Version: v1.00            │
│  │  Image   │  Added: Mar 12, 2026                       │
│  │  300x420 │                                             │
│  │          │  [⬇️ Download]  [📥 Download All Parts]     │
│  │          │                                             │
│  └──────────┘                                             │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Cover Image**:
- **Width**: `300px`, **Height**: `420px` (7:10 ratio)
- **Border-radius**: `6px`
- **Object-fit**: `cover`
- **Margin-right**: `24px`

**Info Block** (right of cover):
- **Title**: `28px`, `700`, `#ffffff`, margin-bottom `8px`
- **Tags row**: `14px`, `#8f98a0`, margin-bottom `4px`
  - Format: `PS4 | Action, Adventure | Region: US`
  - Separator: `|` with `8px` margin
- **Size**: `14px`, `#c7d5e0`, margin-bottom `4px`
- **Version**: `14px`, `#c7d5e0`, margin-bottom `4px`
- **Date added**: `12px`, `#8f98a0`, margin-bottom `16px`
- **Action buttons**:
  - Primary "Download" button: background `#66c0f4`, color `#1b2838`, `14px`, `600`, padding `10px 24px`, border-radius `4px`, hover background `#4ba3d4`
  - Secondary "Download All Parts" button: transparent, border `1px solid #66c0f4`, color `#66c0f4`, `14px`, `600`, padding `10px 24px`, border-radius `4px`, hover background `rgba(102,192,244,0.1)`
  - Gap: `12px`
  - "Download All Parts" only shows if game has multiple parts

### 7.3 Screenshot Gallery

```
┌──────────────────────────────────────────────────────────┐
│  📸 Screenshots                                          │
│                                                          │
│  ←  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  →      │
│     │  img1  │ │  img2  │ │  img3  │ │  img4  │          │
│     │        │ │        │ │        │ │        │          │
│     └────────┘ └────────┘ └────────┘ └────────┘          │
└──────────────────────────────────────────────────────────┘
```

- **Section title**: "📸 Screenshots", `20px`, `600`, `#ffffff`, margin-bottom `16px`
- **Thumbnail size**: `180x100px` each, `object-fit: cover`, border-radius `4px`
- **Gap**: `12px` between thumbnails
- **Hover**: `opacity: 0.8`, cursor pointer
- **Click**: opens lightbox (see Section 7.3.1)
- **Navigation arrows**: `←` `→` buttons, `24x24px`, color `#66c0f4`, hover `#4ba3d4`, positioned left and right of thumbnail row
- **Scroll**: horizontal scroll with overflow-x `auto`, hide scrollbar
- **Thumbnail count**: can be 4-8+, scrollable

#### 7.3.1 Lightbox (Image Viewer)

```
┌────────────────────────────────────────────────────────────┐
│  Background: rgba(0,0,0,0.9), full screen overlay          │
│  Z-index: 1000                                              │
│                                                            │
│                          [X] Close                         │
│                                                            │
│                  ┌──────────────────────┐                  │
│                  │                      │                  │
│                  │                      │                  │
│                  │   Full-size Image    │                  │
│                  │   (max 90vw x 80vh)  │                  │
│                  │   object-fit: contain│                  │
│                  │                      │                  │
│                  │                      │                  │
│                  └──────────────────────┘                  │
│                                                            │
│           ← Previous        3 / 8         Next →           │
│                                                            │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│  │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │ │ 6  │ │ 7  │ │ 8  │ │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ │
│   active: border 2px solid #66c0f4                         │
└────────────────────────────────────────────────────────────┘
```

- **Close button**: X icon, `24x24px`, color `#ffffff`, top-right, `16px` from edges, hover opacity `0.7`
- **Image**: Centered, max `90vw` width, `80vh` height, `object-fit: contain`
- **Navigation**: `← Previous` and `Next →` text buttons, `14px`, color `#ffffff`, hover `#66c0f4`, padding `8px 16px`
- **Counter**: "3 / 8", `14px`, color `#8f98a0`, centered
- **Thumbnail strip**: Bottom, thumbnails `60x40px`, gap `8px`, scrollable horizontally, active image has `2px solid #66c0f4` border
- **Background click**: Clicking outside image closes lightbox
- **Keyboard**: Escape closes, left/right arrows navigate

### 7.4 Description Section

```
┌──────────────────────────────────────────────────────────┐
│  📝 Description                                          │
│                                                          │
│  Experience the epic adventure of Kratos and Atreus as   │
│  they journey through the Norse realms. Full game        │
│  description scraped from the source website...          │
│                                                          │
│  [Read More]  ← if text exceeds 6 lines, show collapsed  │
└──────────────────────────────────────────────────────────┘
```

- **Section title**: "📝 Description", `20px`, `600`, `#ffffff`, margin-bottom `12px`
- **Text**: `14px`, `400`, `#c7d5e0`, line-height `1.7`
- **Collapsed state**: max `6` lines, `overflow: hidden`, text-overflow ellipsis
- **"Read More"**: `14px`, color `#66c0f4`, cursor pointer, hover underline, margin-top `8px`
- **Expanded state**: Full text shown, "Read Less" replaces "Read More"
- **Background**: `#1e2a3a`, padding `20px`, border-radius `6px`, border `1px solid #3a5068`

### 7.5 Videos Section

```
┌──────────────────────────────────────────────────────────┐
│  🎬 Videos (2)                                           │
│                                                          │
│  ┌────────────────────────────────────────┐              │
│  │                                        │              │
│  │              ▶                         │              │
│  │         [Play Button Overlay]          │              │
│  │                                        │              │
│  └────────────────────────────────────────┘              │
│  God of War - Official Launch Trailer    4:32            │
│                                                          │
│  ┌────────────────────────────────────────┐              │
│  │                                        │              │
│  │              ▶                         │              │
│  │         [Play Button Overlay]          │              │
│  │                                        │              │
│  └────────────────────────────────────────┘              │
│  God of War - Gameplay Walkthrough        12:45          │
└──────────────────────────────────────────────────────────┘
```

- **Section title**: "🎬 Videos (2)", `20px`, `600`, `#ffffff`, margin-bottom `12px`
- **Video count**: Shown in parentheses if > 1
- **Video card layout**:
  - **Thumbnail**: `640x360px` (16:9 ratio), border-radius `6px`, object-fit cover
  - **Max width**: constrained to content area width
  - **Play button overlay**: Centered on thumbnail, circular button `64x64px`, background `rgba(0,0,0,0.7)`, play triangle icon `24x24px`, color `#66c0f4`, hover scales to `72x72px`
  - **Video title**: Below thumbnail, `14px`, `500`, `#ffffff`, margin-top `8px`
  - **Duration**: Right-aligned on same line as title, `12px`, `#8f98a0`
- **Click**: Opens embedded YouTube player in a modal (see 7.5.1) or plays inline

#### 7.5.1 Video Player Modal

```
┌───────────────────────────────────────────────────────────┐
│  Background: rgba(0,0,0,0.9), full screen overlay         │
│                                                           │
│  [X] Close                                                │
│                                                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │                                                   │   │
│  │          [YouTube iframe embed / react-player]    │   │
│  │          960x540px (16:9)                         │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  God of War - Official Launch Trailer                     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- **Player**: `960x540px` (16:9 ratio), centered, max `90vw` width
- **YouTube iframe** embedded directly, or use `react-player` component
- **Close**: X button top-right, same as lightbox
- **Background click**: Closes modal
- **Title**: Below player, `16px`, `500`, `#ffffff`, centered, margin-top `12px`

### 7.6 Download Options Section

```
┌──────────────────────────────────────────────────────────┐
│  📥 Download Options                                     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Base Game (45.2 GB)                [⬇️ Download]  │ │
│  │  Hosts: MediaFire, Viking File, Akiabox            │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  Update v1.05 (2.1 GB)              [⬇️ Download]  │ │
│  │  Hosts: MediaFire                                  │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  DLC Pack - Valor Armor (1.8 GB)    [⬇️ Download]  │ │
│  │  Hosts: Akiabox, UploadHaven                       │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

- **Section title**: "📥 Download Options", `20px`, `600`, `#ffffff`, margin-bottom `12px`
- **Background**: `#1e2a3a`, border-radius `6px`, border `1px solid #3a5068`, overflow hidden

**Each download item row**:
- **Background**: transparent
- **Border-bottom**: `1px solid #3a5068` (except last item)
- **Padding**: `16px 20px`
- **File name/label**: Left side, `15px`, `600`, `#ffffff`
  - Format: `Base Game (45.2 GB)` or `Update v1.05 (2.1 GB)` or `DLC Pack - Name (1.8 GB)`
- **Host list**: Below label, `13px`, `#8f98a0`, margin-top `4px`
  - Format: `Hosts: MediaFire, Viking File, Akiabox`
  - Host names colored by reliability:
    - Reliable: `#4caf50` (green)
    - Moderate: `#ff9800` (orange)
    - Poor: `#f44336` (red)
- **Download button**: Right-aligned, inline with file name
  - Background: `#66c0f4`, color: `#1b2838`, `13px`, `600`
  - Padding: `8px 20px`, border-radius `4px`
  - Hover: background `#4ba3d4`
  - Click: Opens Mirror Selection Modal (see Section 8)

---

## 8. MIRROR SELECTION MODAL

```
┌───────────────────────────────────────────────────────────┐
│  Background: rgba(0,0,0,0.6), blurred behind              │
│  Modal: #1e2a3a, border-radius 8px, border 1px #3a5068   │
│  Width: 520px, centered, shadow 0 8px 32px rgba(0,0,0,0.6)│
│                                                           │
│  📥 Download: God of War - Base Game (45.2 GB)            │
│                                                          │
│  Select mirror:                                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  🟢 MediaFire                        [Select ⬇️]   │  │
│  │  Speed: Good | Reliability: High                   │  │
│  │                                                    │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  🟢 Viking File                      [Select ⬇️]   │  │
│  │  Speed: Fast | Reliability: Medium                 │  │
│  │                                                    │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  🟡 Akiabox                        [Select ⬇️]     │  │
│  │  Speed: Medium | Reliability: Good                 │  │
│  │                                                    │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  🔴 UploadHaven                      [Select ⬇️]   │  │
│  │  Speed: Slow | Reliability: Low                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ☑ Remember my choice for this session                   │
│                                                          │
│                        [Cancel]                          │
│                                                          │
└───────────────────────────────────────────────────────────┘
```

### 8.1 Modal Details
- **Title**: "📥 Download: [Game Name] - [File Label] ([Size])", `18px`, `600`, `#ffffff`, padding `20px 24px 16px`
- **Subtitle**: "Select mirror:", `14px`, `#8f98a0`, padding `0 24px 16px`

### 8.2 Mirror Row
- **Height**: `64px`
- **Padding**: `12px 24px`
- **Background**: transparent
- **Border-bottom**: `1px solid #3a5068` (except last)
- **Status dot**: `10x10px` circle, left side
  - Green: `#4caf50`
  - Yellow: `#ff9800`
  - Red: `#f44336`
- **Host name**: `15px`, `500`, `#ffffff`, `8px` right of dot
- **Info text**: Below host name, `12px`, `#8f98a0`, margin-top `2px`
  - Format: `Speed: Good | Reliability: High`
- **Select button**: Right-aligned
  - Background: transparent, border `1px solid #66c0f4`, color `#66c0f4`
  - Text: "Select ⬇️", `13px`, `500`
  - Padding: `6px 16px`, border-radius `4px`
  - Hover: background `rgba(102,192,244,0.1)`

### 8.3 Footer
- **Checkbox**: "Remember my choice for this session", `13px`, `#c7d5e0`
  - Checkbox: `16x16px`, accent `#66c0f4`, checked state filled
  - Label: cursor pointer
- **Cancel button**: Centered below checkbox, transparent, color `#8f98a0`, `14px`, padding `8px`, hover color `#ffffff`

### 8.4 Mirror Row Hover
- Background: `rgba(102,192,244,0.05)`
- Cursor: pointer

### 8.5 Select Click
- Modal shows loading state on the clicked button:
  - Button text changes to "⏳ Resolving..."
  - Button disabled
- After resolution, modal closes and download is added to manager

---

## 9. VIEW: DOWNLOAD MANAGER

### 9.1 Bottom Bar (Collapsed State)

```
┌──────────────────────────────────────────────────────────┐
│  ⬇️ Downloads     ████░░░░░ 45% God of War     [▲ Expand]│
│  Speed: 12.4 MB/s  |  ETA: 18 min                        │
└──────────────────────────────────────────────────────────┘
```

- **Height**: `48px`
- **Background**: `#171d25`
- **Border-top**: `1px solid #3a5068`
- **Padding**: `0 16px`
- **Icon**: Down arrow `18x18px`, color `#66c0f4`
- **Label**: "Downloads", `14px`, `500`, `#ffffff`, `8px` right of icon
- **Active download mini-info**: Center
  - Mini progress bar: `120x4px`, background `#2a475e`, fill `#66c0f4`
  - Percentage: `12px`, `#8f98a0`, right of bar
  - Game name: truncated, `12px`, `#c7d5e0`
- **Speed/ETA**: Right side, `11px`, `#8f98a0`
- **Expand button**: "▲" arrow, `16x16px`, color `#8f98a0`, hover `#66c0f4`, rightmost
- **Click anywhere**: Expands the full panel

### 9.2 Download Manager (Expanded State)

```
┌──────────────────────────────────────────────────────────┐
│  ⬇️ Downloads (3 Active)                           [▼]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [All] [Active] [Queued] [Completed] [Failed]            │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  God of War - Base Game                    45.2 GB       │
│  Source: MediaFire                             45%       │
│  ████████████░░░░░░░░░░░░░  12.4 MB/s  ETA: 18 min     │
│                    [⏸ Pause] [❌ Cancel] [📁 Open File]  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Update v1.05                              2.1 GB        │
│  Source: MediaFire                            12%        │
│  ██░░░░░░░░░░░░░░░░░░░░░░  4.2 MB/s  ETA: 8 min        │
│                    [⏸ Pause] [❌ Cancel] [📁 Open File]  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  DLC Pack - Valor Armor                    1.8 GB        │
│  Source: Akiabox                           ✓ Done        │
│  ████████████████████████  Extracted to folder           │
│                          [📂 Open Folder] [🗑 Remove]     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Expanded panel details**:
- **Height**: `320px` (fixed when expanded)
- **Slide-up animation**: `0.3s ease` from bottom
- **Background**: `#171d25`
- **Border-top**: `1px solid #3a5068`

**Header**:
- "⬇️ Downloads (3 Active)", `16px`, `600`, `#ffffff`, padding `12px 16px`
- Close button "▼", right-aligned, `16x16px`, color `#8f98a0`, hover `#ffffff`

**Tabs**:
- Row of tab buttons: All, Active, Queued, Completed, Failed
- **Height**: `36px`, padding `0 16px`
- **Text**: `13px`, `500`, color `#8f98a0`
- **Active tab**: color `#66c0f4`, border-bottom `2px solid #66c0f4`
- **Hover**: color `#c7d5e0`
- **Badge on tab**: Small number in parentheses, e.g., "Active (3)", `11px`, `#8f98a0`

**Download Item**:
- **Padding**: `16px`
- **Border-bottom**: `1px solid #3a5068`
- **File name**: `14px`, `600`, `#ffffff`
- **File size**: Right-aligned, `13px`, `#8f98a0`
- **Source**: "Source: MediaFire", `12px`, `#8f98a0`, margin-top `4px`
- **Status/Progress**: Right-aligned, `13px`, `600`
  - Active: `#66c0f4`
  - Queued: `#ff9800`
  - Done: `#4caf50`
  - Failed: `#f44336`
- **Progress bar**: Full width, `8px` height, background `#2a475e`, border-radius `4px`, fill `#66c0f4`, margin-top `8px`
  - Animated fill: `transition: width 0.5s ease`
- **Speed & ETA**: Below progress bar, `12px`, `#8f98a0`, format: `12.4 MB/s | ETA: 18 min`
- **Action buttons**: Right-aligned, below progress bar, gap `8px`, margin-top `8px`
  - Pause: transparent, border `1px solid #3a5068`, color `#c7d5e0`, `12px`, padding `4px 12px`, border-radius `4px`, hover border `#66c0f4`
  - Cancel: transparent, border `1px solid #f44336`, color `#f44336`, `12px`, padding `4px 12px`, border-radius `4px`, hover background `rgba(244,67,54,0.1)`
  - Open File / Open Folder: transparent, border `1px solid #3a5068`, color `#c7d5e0`, `12px`, padding `4px 12px`, border-radius `4px`
  - Remove (completed): same as Open Folder style

**Empty state per tab**:
- "No downloads in this category", `14px`, `#8f98a0`, centered, padding `40px 0`

### 9.3 Context Menu (Right-click on Download)
```
┌──────────────────────┐
│  ⏸ Pause             │
│  ▶ Resume            │
│  🔄 Retry            │
│  ├───────────────────┤
│  📁 Open File        │
│  📂 Open Folder      │
│  ├───────────────────┤
│  🗑 Remove from List  │
│  ❌ Cancel & Delete  │
└──────────────────────┘
```
- **Background**: `#2a475e`, border `1px solid #3a5068`, border-radius `6px`
- **Width**: `200px`
- **Item height**: `32px`, padding `0 12px`
- **Text**: `13px`, `#c7d5e0`
- **Hover**: background `rgba(102,192,244,0.1)`, color `#ffffff`
- **Disabled items**: color `#3a5068`, cursor not-allowed
- **Divider**: `1px solid #3a5068`, margin `4px 8px`

---

## 10. VIEW: SETTINGS

### 10.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                              │
├──────────────┬───────────────────────────────────────────┤
│              │                                           │
│ 📁 General   │   Download Location                       │
│ ⬇️ Downloads │   /home/user/Games/PS4-PKGs               │
│ 📦 Extract   │   [Browse...]                             │
│ 🌐 Network   │                                           │
│ 🔔 Notif     │   ─────────────────────────────────       │
│ 🎨 Appearance│                                           │
│ ℹ️ About     │   Auto-Extract Archives                   │
│              │   [✓] Enable                              │
│              │   [✓] Delete archive after extract        │
│              │   [ ] Extract to subfolder                │
│              │                                           │
│              │   ─────────────────────────────────       │
│              │                                           │
│              │   Max Concurrent Downloads                │
│              │   [ 2 ]  ← spinner (1-5)                  │
│              │                                           │
│              │         [Reset Defaults]    [Save]        │
│              │                                           │
└──────────────┴───────────────────────────────────────────┘
```

### 10.2 Settings Sidebar
- **Width**: `200px`, fixed
- **Background**: `#171d25`
- **Border-right**: `1px solid #3a5068`
- **Padding**: `16px 0`
- Each setting category:
  - **Height**: `40px`, padding `0 16px`
  - **Icon**: `18x18px`
  - **Text**: `14px`, `500`, `#c7d5e0`
  - **Hover**: background `rgba(102,192,244,0.08)`, color `#66c0f4`
  - **Active**: background `rgba(102,192,244,0.15)`, color `#66c0f4`, left border `3px solid #66c0f4`

### 10.3 Settings Content Area
- **Padding**: `24px`
- **Background**: `#1b2838`

**Section Title**: `20px`, `600`, `#ffffff`, margin-bottom `20px`

**Setting Row**:
- **Layout**: Flex row, space-between
- **Padding**: `12px 0`
- **Border-bottom**: `1px solid #3a5068` (except last)
- **Label**: `14px`, `500`, `#c7d5e0`, left side
- **Control**: Right side (varies by type)

**Control Types**:
- **Text input**: Background `#2a475e`, border `1px solid #3a5068`, color `#ffffff`, `14px`, padding `8px 12px`, border-radius `4px`, width `280px`
- **Browse button**: Next to path input, background `#2a475e`, border `1px solid #3a5068`, color `#c7d5e0`, `13px`, padding `8px 16px`, border-radius `4px`, hover background `#3a5068`
- **Toggle switch**: 
  - Track: `40x20px`, background `#3a5068`, border-radius `10px`
  - Thumb: `16x16px`, background `#8f98a0`, border-radius `50%`, margin `2px`
  - ON state: track `#66c0f4`, thumb `#ffffff`
  - Transition: `0.2s ease`
- **Dropdown select**: Background `#2a475e`, border `1px solid #3a5068`, color `#ffffff`, `14px`, padding `8px 12px`, border-radius `4px`, width `160px`
- **Number spinner/input**: Background `#2a475e`, border `1px solid #3a5068`, color `#ffffff`, `14px`, padding `8px 12px`, border-radius `4px`, width `60px`, text-align center
- **Checkbox**: `16x16px`, accent `#66c0f4`, label `14px`, `#c7d5e0`, gap `8px`
- **Radio buttons**: Standard style, accent `#66c0f4`

**Verify button** (for yt-dlp path):
- Text: "Check ✓" or "Verify"
- Success state: green check `✓`, color `#4caf50`
- Error state: red X `✗`, color `#f44336`

**Action Buttons** (bottom):
- **Reset Defaults**: transparent, border `1px solid #3a5068`, color `#8f98a0`, `14px`, padding `10px 20px`, border-radius `4px`, hover border `#8f98a0`
- **Save**: background `#66c0f4`, color `#1b2838`, `14px`, `600`, padding `10px 24px`, border-radius `4px`, hover `#4ba3d4`
- **Alignment**: Right-aligned, gap `12px`, margin-top `24px`
- **Save button** only appears/enabled when changes are made (dirty state)

### 10.4 Settings Categories Content

**📁 General**:
| Label | Control | Default |
|-------|---------|---------|
| Download Location | Path input + Browse | `~/Downloads/PS4-PKGs` |
| Create game subfolder | Toggle | ON |

**⬇️ Downloads**:
| Label | Control | Default |
|-------|---------|---------|
| Max concurrent downloads | Number (1-5) | 2 |
| Speed limit | Dropdown (None/5/10/20/50 MB/s) | None |
| Retry failed downloads | Number (0-10) | 3 |
| Retry delay (seconds) | Number | 30 |
| yt-dlp executable path | Path input + Verify | Auto-detect |
| Use proxy | Toggle | OFF |
| Proxy URL | Text input (disabled if proxy off) | — |

**📦 Extract**:
| Label | Control | Default |
|-------|---------|---------|
| Auto-extract archives | Toggle | ON |
| Supported formats: .zip | Checkbox | ON |
| Supported formats: .rar | Checkbox | ON |
| Supported formats: .7z | Checkbox | ON |
| Extract to | Radio: Subfolder / Same dir / Custom | Subfolder |
| Delete archive after extract | Toggle | OFF |

**🌐 Network**:
| Label | Control | Default |
|-------|---------|---------|
| Download timeout (seconds) | Number | 300 |
| Connection timeout (seconds) | Number | 30 |
| Use system proxy | Toggle | ON |
| Custom proxy URL | Text input | — |

**🔔 Notifications**:
| Label | Control | Default |
|-------|---------|---------|
| Download complete | Toggle | ON |
| Download failed | Toggle | ON |
| Extraction complete | Toggle | ON |
| Sound alert | Toggle | OFF |
| Desktop notification | Toggle | ON |

**🎨 Appearance**:
| Label | Control | Default |
|-------|---------|---------|
| Theme | Radio: Dark (Steam) / Dark (PS Store) | Dark (Steam) |
| Card size | Dropdown: Small / Medium / Large | Medium |
| Show game size on cards | Toggle | ON |
| Compact mode | Toggle | OFF |

**ℹ️ About**:
```
┌─────────────────────────────────────┐
│                                     │
│   🎮 PS4 PKG Downloader v0.1.0     │
│                                     │
│   Built with Electron + React       │
│                                     │
│   [Check for Updates]               │
│                                     │
│   Logs: [Open Logs Folder]          │
│   Cache: [Clear Cache] (24.5 MB)    │
│                                     │
└─────────────────────────────────────┘
```
- Centered in content area
- **App name**: `20px`, `700`, `#ffffff`
- **Version**: `14px`, `#8f98a0`
- **Tech info**: `13px`, `#8f98a0`
- **Buttons**: Standard style, margin-top `8px`

---

## 11. COMMON COMPONENTS

### 11.1 Toast Notifications

```
┌───────────────────────────────────┐
│  ✓  Download complete: God of War │
│                          [X]      │
└───────────────────────────────────┘
```

- **Position**: Bottom-right corner, above download manager, `16px` from edges
- **Width**: `320px`
- **Background**: `#2a475e`
- **Border**: `1px solid #3a5068`
- **Border-radius**: `6px`
- **Padding**: `12px 16px`
- **Icon**: Left side
  - Success: `✓`, color `#4caf50`
  - Error: `✗`, color `#f44336`
  - Info: `ℹ`, color `#66c0f4`
- **Text**: `14px`, `#ffffff`
- **Close button**: X, `16x16px`, color `#8f98a0`, right side
- **Auto-dismiss**: 5 seconds, slide out animation
- **Stack**: Multiple toasts stack vertically with `8px` gap

### 11.2 Loading Spinner

- **Size**: `24x24px`
- **Border**: `3px solid #3a5068`
- **Border-top**: `3px solid #66c0f4`
- **Border-radius**: `50%`
- **Animation**: spin `0.8s linear infinite`
- **Centered** when loading a view

### 11.3 Tooltip

- **Background**: `#2a475e`
- **Text**: `12px`, `#ffffff`
- **Padding**: `6px 10px`
- **Border-radius**: `4px`
- **Shadow**: `0 2px 8px rgba(0,0,0,0.3)`
- **Arrow**: Small triangle pointing to target
- **Show delay**: 0.5s hover
- **Position**: Below or above target element

### 11.4 Confirmation Dialog

```
┌──────────────────────────────────────────┐
│                                          │
│  ⚠️  Cancel Download?                    │
│                                          │
│  Are you sure you want to cancel         │
│  "God of War - Base Game"?               │
│  Partial download will be deleted.       │
│                                          │
│         [No]        [Yes, Cancel]        │
│                                          │
└──────────────────────────────────────────┘
```

- **Overlay**: `rgba(0,0,0,0.6)`, full screen
- **Modal**: `#1e2a3a`, border `1px solid #3a5068`, border-radius `8px`, width `400px`, centered
- **Shadow**: `0 8px 32px rgba(0,0,0,0.6)`
- **Icon**: Warning triangle, `24x24px`, color `#ff9800`, left of title
- **Title**: `18px`, `600`, `#ffffff`, padding `20px 24px 12px`
- **Message**: `14px`, `#c7d5e0`, padding `0 24px 20px`, line-height `1.5`
- **Buttons**: Right-aligned, gap `12px`
  - Cancel/No: transparent, color `#c7d5e0`, `14px`, padding `8px 20px`
  - Confirm/Yes: background `#f44336`, color `#ffffff`, `14px`, `600`, padding `8px 20px`, border-radius `4px`, hover `#d32f2f`

---

## 12. RESPONSIVE BEHAVIOR

### 12.1 Window Sizes

| Size | Width | Behavior |
|------|-------|----------|
| Small | < 1024px | Sidebar collapses to icons-only (48px), 3-column grid |
| Medium | 1024-1280px | Full sidebar, 4-column grid |
| Large | > 1280px | Full sidebar, 5-column grid |

### 12.2 Collapsed Sidebar (Small Windows)
- Width: `48px`
- Icons centered, labels hidden
- Hover shows tooltip with label
- Navigation items still functional

### 12.3 Game Detail on Small Windows
- Cover image stacks: cover on top, info below
- Cover: `200x280px`, centered
- Info: text-align center
- Action buttons: centered below info

### 12.4 Video Player on Small Windows
- Player scales down to `640x360px` minimum
- Maintains 16:9 ratio

---

## 13. INTERACTIONS SUMMARY

| Action | Result |
|--------|--------|
| Click game card | Navigate to Game Detail view |
| Click Download button | Open Mirror Selection Modal |
| Select mirror | Resolve link via yt-dlp, add to Download Manager |
| Click Downloads button (top nav) | Toggle bottom Download Manager panel |
| Click sidebar item | Navigate to corresponding view |
| Click genre in sidebar | Filter game grid by genre |
| Click search result | Navigate to Game Detail view |
| Click screenshot thumbnail | Open Lightbox |
| Click video thumbnail | Open Video Player Modal |
| Right-click download item | Show Context Menu |
| Click Settings gear | Open Settings view |
| Toggle auto-extract | Enable/disable extraction on completion |
| Click Browse (settings) | Open folder picker dialog |
| Click Save (settings) | Save settings, show toast, hide Save button |
| Click Reset Defaults (settings) | Reset all settings to default |
| Click Back (detail view) | Return to previous view |
| Close modal/dialog | Return to underlying view |
| Resize window | All layouts adjust responsively |

---

## 14. ACCESSIBILITY

- **Keyboard navigation**: Tab through all interactive elements
- **Focus indicators**: `2px solid #66c0f4` outline on focused elements
- **Screen reader**: All icons have `aria-label` attributes
- **Color contrast**: All text meets WCAG AA standards (4.5:1 minimum)
- **Skip links**: Not applicable for desktop app
- **Reduced motion**: Respect OS setting — disable animations if `prefers-reduced-motion` is active

---

## 15. ICONS REFERENCE

All icons should be SVG, consistent size, from a single icon set (e.g., Lucide, Heroicons, or Material Symbols):

| Icon | Usage | Size |
|------|-------|------|
| Home | Sidebar nav | 18px |
| Trending/Fire | Sidebar nav | 18px |
| New/Clock | Sidebar nav | 18px |
| Folder | Sidebar, open file | 18px |
| Search | Search bar | 16px |
| Gear/Settings | Top nav | 20px |
| Download arrow | Top nav, download buttons | 20px |
| Gamepad | Logo, empty state | 20-64px |
| Play triangle | Video thumbnails | 24px |
| Arrow left | Back button, pagination | 16px |
| Arrow right | Pagination, next image | 16px |
| X / Close | Modals, clear search | 16-24px |
| Pause | Download actions | 16px |
| Cancel/Delete | Download actions | 16px |
| Check mark | Success states | 16px |
| Warning triangle | Confirm dialogs | 24px |
| Info (i) | Info tooltips | 16px |
| Chevron down | Dropdowns | 16px |
| Eye | View toggle list | 20px |
| Grid | View toggle grid | 20px |
| Bell | Notifications tab | 18px |
| Palette | Appearance tab | 18px |
| Network/globe | Network tab | 18px |
| Package/box | Extract tab | 18px |
| Trash | Remove from list | 16px |

---

## 16. COLOR STATUS INDICATORS FOR MIRRORS

| Status | Dot Color | Speed Label | Used When |
|--------|-----------|-------------|-----------|
| 🟢 Good | `#4caf50` | "Speed: Good" | Few ads, fast direct links, reliable |
| 🟢 Fast | `#4caf50` | "Speed: Fast" | Quick downloads, moderate reliability |
| 🟡 Medium | `#ff9800` | "Speed: Medium" | More ads, wait timers, but works |
| 🔴 Slow | `#f44336` | "Speed: Slow" | Heavy ads, captchas, unreliable |

---

*End of UI Specification*
