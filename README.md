# \# Project Specification: Expense \& Budget Visualizer

# 

# \## 1. Project Overview

# A mobile-friendly web application designed to help users track their daily spending. The app features a total balance display, transaction history, and visual charts for category-based distribution.

# 

# \## 2. Technical Constraints (Strict Compliance)

# \* \*\*Tech Stack:\*\* HTML, CSS, and Vanilla JavaScript only (No Frameworks like React or Vue).

# \* \*\*Data Storage:\*\* Browser Local Storage API for client-side persistence.

# \* \*\*Folder Structure:\*\* Exactly one file for each type: `index.html`, `css/style.css`, and `js/script.js`.

# \* \*\*Deployment:\*\* Published via GitHub Pages.

# 

# \## 3. Core Features (MVP)

# \* \*\*Input Form:\*\*

# &#x20;   \* Fields: Item Name, Amount, and Category.

# &#x20;   \* Validation: Ensure all fields are filled before data entry.

# \* \*\*Transaction List:\*\*

# &#x20;   \* Scrollable list showing Name, Amount, and Category.

# &#x20;   \* Delete button for each transaction item.

# \* \*\*Total Balance:\*\*

# &#x20;   \* Dynamic display at the top that updates automatically upon changes.

# \* \*\*Visual Chart:\*\*

# &#x20;   \* Pie Chart (using Chart.js) showing spending distribution by category.

# 

# \## 4. Personalized Features (Optional Challenges)

# Based on the project plan, the following 3 challenges are selected:

# 1\. \*\*Add Custom Categories:\*\* Users can define new categories (e.g., Education, Health) saved in Local Storage.

# 2\.  \*\*Monthly Summary View:\*\* A feature to view total expenses filtered by a specific month.

# 3\.  \*\*Sort Transactions:\*\* Ability to sort the history by amount (High/Low) or category.

# 

# \## 5. Advanced Analytical Plan

# \* \*\*Spending Curve (Line Chart):\*\* An additional visualization using Chart.js to track spending trends and compare variance between the current and previous months.

# \* \*\*Month-over-Month Variance:\*\* A calculated indicator showing the percentage increase or decrease in spending compared to the prior month.

# 

# \## 6. Crucial Implementation Tips for Performance \& UX (NFR Compliance)

# \* \*\*Date Stamping:\*\* Every transaction object stored in `localStorage` must include a `date` property (ISO string) to enable temporal sorting and the Monthly Summary feature.

# \* \*\*Currency Formatting:\*\* Use `Intl.NumberFormat('id-ID')` to display amounts in a readable Indonesian Rupiah (Rp) format or as per the UI reference.

# \* \*\*Responsive UI:\*\* Use CSS Flexbox/Grid and Media Queries to ensure the app is truly "mobile-friendly" as required by the brief.

# \* \*\*Empty State Management:\*\* Display a user-friendly placeholder message when the transaction list is empty to maintain a clean visual hierarchy.

# \* \*\*Deletion Confirmation:\*\* Implement a simple `confirm()` dialog before deleting a transaction to prevent accidental data loss.

# \* \*\*Visual Hierarchy:\*\* Follow the provided UI reference: prominent Total Balance at the top, followed by the Input Form, and the List/Chart side-by-side or stacked.

# 

# \### Implementation Detail: Custom Categories

# \* The app must allow users to define and save new categories (e.g., Education, Health).

# \* Custom categories must be persisted in Local Storage alongside transaction data.

# \* The "Category" dropdown in the Input Form must dynamically update to include these custom options.

# 

# \## 7. Enhanced UI/UX: Unified Dashboard \& Month Selector

# \### A. Unified Dashboard Container

# \* \*\*Structure:\*\* Wrap History, Visualization, and Monthly Summary inside a single primary container (e.g., `.dashboard-card`) to maintain a clean visual hierarchy, and change visualization base on which month's spending.

# \* \*\*Design:\*\* Apply consistent padding, rounded corners, and subtle shadows to match the "Extra" brand aesthetic.

# 

# \### B. Horizontal Month Selector (Center-Highlight Logic)

# \* \*\*Layout:\*\* A horizontal scrollable menu containing month labels (e.g., Jan 2026, Feb 2026).

# \* \*\*Scroll Snap:\*\* Implement `scroll-snap-type: x mandatory` in CSS so the selected month always "snaps" to the center of the container.

# \* \*\*Visual Highlight:\*\* \* The month in the center of the viewport must be highlighted (larger font, bolder weight, or distinct color).

# &#x20;   \* Use Vanilla JavaScript (`Intersection Observer` or `scroll` listener) to toggle the `.active-month` class.

# 

# \### C. Temporal Data Filtering

# \* \*\*Logic:\*\* Selecting a month triggers an automatic filter of data from `localStorage`.

# \* \*\*Dynamic Updates:\*\* Real-time updates for Transaction History, Pie Chart distribution, and Monthly Summary based on the selected month.

# 

