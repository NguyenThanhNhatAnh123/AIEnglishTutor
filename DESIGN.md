\---

version: alpha

name: EduFlow AI Workspace



description: |

&#x20; A modern AI-first education management platform inspired by

&#x20; ChatGPT, Notion, Linear, and Perplexity.



tokens:

&#x20; colors:

&#x20;   background: "#F7F7F8"

&#x20;   surface: "#FFFFFF"

&#x20;   surface-secondary: "#FAFAFA"

&#x20;   surface-hover: "#F3F4F6"



&#x20;   border: "#E5E7EB"

&#x20;   border-light: "#F1F5F9"



&#x20;   text-primary: "#111827"

&#x20;   text-secondary: "#6B7280"

&#x20;   text-muted: "#9CA3AF"



&#x20;   accent: "#111827"

&#x20;   accent-hover: "#1F2937"



&#x20;   success: "#16A34A"

&#x20;   warning: "#D97706"

&#x20;   danger: "#DC2626"



&#x20; radius:

&#x20;   sm: "10px"

&#x20;   md: "16px"

&#x20;   lg: "22px"

&#x20;   xl: "28px"



&#x20; spacing:

&#x20;   xs: 4

&#x20;   sm: 8

&#x20;   md: 16

&#x20;   lg: 24

&#x20;   xl: 32

&#x20;   xxl: 48



&#x20; shadows:

&#x20;   sm: "0 1px 2px rgba(0,0,0,0.04)"

&#x20;   md: "0 2px 8px rgba(0,0,0,0.05)"

&#x20;   lg: "0 6px 20px rgba(0,0,0,0.06)"



typography:

&#x20; fontFamily: "Inter"



&#x20; h1:

&#x20;   fontSize: "36px"

&#x20;   fontWeight: 700

&#x20;   lineHeight: 1.1



&#x20; h2:

&#x20;   fontSize: "28px"

&#x20;   fontWeight: 600

&#x20;   lineHeight: 1.2



&#x20; h3:

&#x20;   fontSize: "22px"

&#x20;   fontWeight: 600

&#x20;   lineHeight: 1.3



&#x20; body:

&#x20;   fontSize: "15px"

&#x20;   fontWeight: 400

&#x20;   lineHeight: 1.6



&#x20; small:

&#x20;   fontSize: "13px"

&#x20;   fontWeight: 400

&#x20;   lineHeight: 1.5



\---



\# EduFlow AI Workspace Design System



\## Core Philosophy



The interface should feel:



\- calm

\- intelligent

\- minimal

\- premium

\- productivity-focused



Inspired by:



\- ChatGPT

\- Notion

\- Linear

\- Perplexity

\- Vercel



The UI must prioritize:

\- readability

\- spacing

\- typography hierarchy

\- focus

\- simplicity



Avoid visual noise.



\---



\# Global UI Rules



\## Use



\- large spacing

\- subtle borders

\- soft hover states

\- modern typography

\- monochrome palette

\- rounded corners

\- lightweight cards

\- clean layouts

\- reusable UI components



\## Avoid



\- Bootstrap appearance

\- colorful admin dashboards

\- heavy gradients

\- giant shadows

\- cramped layouts

\- glossy effects

\- thick borders

\- neon colors

\- random spacing

\- inconsistent radius



\---



\# Layout System



\## Main Layout



Use:

\- left sidebar

\- sticky top navigation

\- responsive content container



Content width should feel breathable.



Preferred max width:

\- 1440px



Standard page padding:

\- 24px desktop

\- 16px tablet

\- 12px mobile



\---



\# Sidebar Design



Sidebar should resemble modern AI workspaces.



\## Sidebar Style



Background:

\- pure white



Border:

\- 1px solid border color



Width:

\- 260px desktop

\- collapsible on tablet/mobile



\## Navigation Items



Use:

\- monochrome outline icons

\- subtle hover background

\- rounded hover states



Hover:

\- background: surface-hover



Active:

\- background: #ECECEC

\- font-weight: 600



Never use:

\- colorful icons

\- gradients

\- glassmorphism

\- dark sidebar



\---



\# Icon System



Use:

\- Lucide Icons only



Icon style:

\- outline

\- rounded

\- minimal

\- 2px stroke



Preferred size:

\- 18px–20px



Avoid:

\- filled icons

\- 3D icons

\- emoji-style icons

\- inconsistent icon packs



\---



\# Typography Rules



Use:

\- Inter font family



Typography hierarchy is critical.



\## Headings



Should:

\- feel clean

\- use bold weight

\- have tight line-height



\## Body Text



Should:

\- prioritize readability

\- use muted secondary colors

\- avoid pure black



Never:

\- use tiny text

\- overcrowd content



\---



\# Card Design



Cards should feel lightweight and modern.



\## Card Style



Background:

\- white



Border:

\- thin subtle border



Radius:

\- 18px–22px



Shadow:

\- minimal only



Padding:

\- 20px–24px



\## Card Behavior



Hover:

\- subtle border darkening

\- very soft elevation



Avoid:

\- giant shadows

\- colorful backgrounds

\- glossy effects



\---



\# Table Design



Tables must feel modern and spacious.



\## Table Rules



Use:

\- large row height

\- sticky headers

\- subtle separators

\- soft hover states



Row hover:

\- background: #FAFAFA



Padding:

\- generous horizontal spacing



Text:

\- left aligned

\- muted metadata

\- bold important values



Avoid:

\- Bootstrap table styles

\- dark striped rows

\- heavy borders



\---



\# Form Design



Forms should feel clean and frictionless.



\## Inputs



Height:

\- 44px–48px



Border:

\- soft gray border



Focus:

\- subtle dark border

\- soft ring



Radius:

\- 14px–16px



Padding:

\- spacious



Avoid:

\- glowing blue outlines

\- sharp corners



\---



\# Buttons



Buttons should feel minimal and professional.



\## Primary Button



Background:

\- text-primary



Text:

\- white



Hover:

\- slightly lighter dark tone



Height:

\- 42px–46px



Radius:

\- 14px



\## Secondary Button



Background:

\- white



Border:

\- subtle gray



Hover:

\- light gray background



Avoid:

\- gradients

\- giant shadows

\- oversaturated colors



\---



\# Modal Design



Modals should feel elegant and lightweight.



\## Modal Rules



Use:

\- centered layout

\- soft backdrop blur

\- spacious padding



Radius:

\- 20px+



Max width:

\- 560px–720px



Avoid:

\- full-screen modals unless necessary



\---



\# Charts \& Analytics



Charts should feel subtle and premium.



\## Rules



Use:

\- minimal grid lines

\- soft neutral colors

\- smooth curves

\- clean spacing



Avoid:

\- rainbow chart palettes

\- glowing effects

\- excessive legends



Charts should support:

\- hover tooltips

\- responsive layouts



\---



\# Motion \& Animation



Animations should be subtle.



Use:

\- fade

\- slight translate

\- smooth hover transitions



Duration:

\- 150ms–250ms



Avoid:

\- bouncing

\- elastic motion

\- flashy effects



\---



\# Mobile Experience



The UI must be fully responsive.



\## Mobile Rules



Sidebar:

\- collapsible drawer



Cards:

\- stacked vertically



Tables:

\- horizontally scrollable



Touch targets:

\- minimum 44px



Spacing:

\- reduced but breathable



\---



\# Accessibility



Must support:

\- keyboard navigation

\- focus states

\- screen readers

\- contrast accessibility



Never sacrifice readability for aesthetics.



\---



\# Frontend Stack



Preferred stack:



\- React

\- TailwindCSS

\- shadcn/ui

\- Lucide Icons

\- Framer Motion

\- Recharts



\---



\# Component Architecture



Use reusable UI components only.



Examples:



\- AppSidebar

\- TopNavbar

\- DashboardCard

\- AnalyticsCard

\- ModernTable

\- EmptyState

\- PageHeader

\- AppModal

\- ConfirmDialog

\- FormInput

\- SearchBar



Avoid inline styles.



\---



\# AI Coding Instructions



When generating UI:



\- always follow DESIGN.md

\- preserve business logic

\- prioritize UX clarity

\- maintain spacing consistency

\- use semantic layouts

\- avoid generic admin-template appearance



The interface should feel like a premium AI workspace product.

