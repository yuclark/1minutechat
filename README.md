# ⚡ OneMinuteChat — Anonymous Interest Matching

An ultra-sleek, cyber-minimalist anonymous chatting platform engineered with an asynchronous, multi-threaded Rust backend and a highly responsive, cinematic frontend layout. Connect with users worldwide over secure tunnels based on overlapping interest tags, with automated fallback states and non-persistent session persistence.

---

## 🚀 Core Architectural Features

* **🧠 Smart Interest-Targeted Matchmaking:** Users enter interest tags which the backend evaluates in real-time. The system searches for exact tag intersections first, enforcing a strict **60-second queue timeout** before gracefully falling back to a random stranger pairing to eliminate wait times.
* **⏳ Synchronized 60-Second Sessions:** Match lifecycles are dictated directly by concurrent async workers on the server. A thread-safe ticker streams unified countdown intervals back to both clients via WebSockets, ensuring zero clock drift.
* **🔒 Strict Non-Persistent Privacy Architecture:** No databases, no tracking cookies, and no persistent state logs. Every session data footprint is stored completely inside memory registers (`State`) and is completely vaporized the moment a connection link breaks or times out.
* **🎨 High-End Startup UI/UX:** A premium dark-mode dashboard tailored with an interactive tag-chip builder, screen-slide view switchers, a cinematic orbital radar loading panel with dynamic status string rotators, and full mobile-native viewport adaptations.
* **⚡ Battle-Tested Async Race-Condition Guarding:** Implements an instance-specific `MatchId` signature layer. If a user triggers a rapid **Skip** command, older concurrent timer worker threads drop instantly upon identifying outdated match hashes, preventing telemetry flickering.
* **💤 Continuous Keep-Awake Framework:** Native lightweight `/health` HTTP endpoint exposed to handle cloud server anti-idling tasks via scheduled external ping configurations.

---

## 🛠️ Technology Workspace Stack

### Backend Engine Core
* **Language:** Rust (Stable release ecosystem)
* **Framework:** `Axum` (Web routing framework engineered on top of `hyper`)
* **Runtime Layer:** `Tokio` (Multi-threaded asynchronous I/O runtime executor)
* **Protocol Pipeline:** High-performance native WebSockets (`axum::extract::ws`)
* **Data Frames Processing:** `Serde` + `Serde_JSON` (Compile-time serialization/deserialization frameworks)

### Frontend Workspace Client
* **Layout Mechanics:** Semantic HTML5 Structure + Clean CSS Grid & Modern Flexbox
* **Visual Transitions:** Custom hardware-accelerated CSS Keyframe Animations (Orbital inward-travel wave modules)
* **State Operations:** Vanilla ECMAScript 6 Browser Native `WebSocket` Engine
* **Branding Shell:** FontAwesome Vector Icon Layout Packages + Inter Typography via Google CDN

---

## 📁 Repository Directory Structure

```text
├── backend/
│   ├── src/
│   │   ├── main.rs         # Application Entryway, Axum Router setup, & Cloud Port Bindings
│   │   ├── state.rs        # Global, thread-safe shared application memory space parameters
│   │   ├── matchmaker.rs   # Two-stage background execution engine loop with timeout fallbacks
│   │   ├── ws.rs           # WebSocket channel handshake lifecycle supervisor
│   │   └── protocol.rs     # Client-to-Server framing message serialization enums
│   └── Cargo.toml
└── frontend/
    ├── index.html          # Structural UI/UX canvas wrapper & high-end dark dashboard styles
    └── app.js              # State orchestration engine & protocol network interface handler