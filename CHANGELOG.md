# Personal Portfolio Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## The number [1.0.0] follows Semantic Versioning (SemVer) format: RELEASE.MINOR.PATCH

# RELEASE (1): Initial release with core features
# MINOR (0): -New features- that are backward compatible
# PATCH (0): Bug fixes that are backward compatible

## [Unreleased]

### Added
- Animated initial logo
- Entry level face animation
- Tablet-responsive design with touch controls

## [1.0.0] - 2025-12-17

### Added
- Loading screen with battery animation
- Personal portfolio website
- CSS styling with custom fonts (Doto, Jersey 10)
- Mobile gaming controls with joystick
- Desktop navigation with hover effects
- Game canvas integration
- Responsive design for multiple screen sizes
- Handrawn right side of face for split-face background
- Navigation bar with three sections: about, dual deployment, and contact
- Interactive 3D gaming experience button that types out text

### Enhanced
- Navigation system with improved mobile hamburger menu
- Loading screen with enhanced battery animation
- Responsive design optimizations for mobile and desktop
- CSS styling with better visual hierarchy and animations
- Game integration with proper canvas management and controls

## Fixed
- The function toggleMenu in script file didnt have the proper naming
- Removed unneccassary code and comments for multpile files


## [2.0.0] - 2026-04-03

### Added
- Digital resume layout in About section with two-column grid (experience left, skills + education right)
- Experience timeline with glowing accent dots and full bullet points for both roles
- Skills grid organized by category: Languages, Frameworks, Database, Cloud & DevOps, Creative
- Education block with degree, minor, and university
- Resume intro with title, tagline, and summary paragraph
- LinkedIn SVG icon replacing briefcase emoji in contact section
- GitLab SVG icon replacing octopus emoji in contact section
- Formspree integration on contact form for real email delivery
- Walker divider strips between sections on mobile — stick woman walks across collecting skills on scroll
- Three divider strips: Frontend skills (after hero), Backend skills (after About), Creative skills (after Projects)
- Skills dynamically positioned in JS, first word anchors left, last anchors right, middle centered
- Stick woman flips direction when user scrolls back up and re-collects skills
- Mobile marquee replaced with scroll-driven walker dividers
- Project cards updated to real personal projects: Interactive Portfolio, Digital Illustration, Cloud Calculator, 3D Car Racing Game
- Project links moved to bottom-right of each card
- Play Game link wired to trigger game on both desktop and mobile
- Section titles now consistent across About, Projects, and Contact with gradient text and underline bar

### Changed
- About section rebuilt as digital resume replacing generic intro
- Skills display changed from heavy bordered cards to inline pill rows per category
- Skill category labels now stack above pills instead of inline
- Project card padding and gap reduced for better proportion
- Nav link hover color lightened
- Desktop skill rail hidden on mobile (max-width: 1200px)
- Contact form fields no longer use native `required` — validation handled in JS on submit with red border highlight
- Cancel and Close buttons bypass form validation via `type="button"`
- Modal centered with `margin: auto`, inputs fixed with `box-sizing: border-box`
- Section title hint removed from About (info now lives in the resume layout)
- Enterprise Dashboard project card removed (internal system, not publicly viewable)

### Fixed
- LinkedIn and GitHub links corrected from invalid `<span a href>` to proper `<a>` tags
- Added `rel="noopener noreferrer"` to external links to prevent reverse tabnabbing
- Mobile hamburger nav spacing fixed with `justify-content: space-between`
- Deployments section background matched to About and Contact sections
- Section title conflicting CSS rules resolved — all three sections now render consistently


