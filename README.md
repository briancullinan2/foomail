
# Foo Mail

An end-to-end encrypted, client-side email interface and local data engine using client-side proxies for standard mail protocols (IMAP/SMTP/Newsgroup) while maintaining zero-knowledge local security.

---

## 1. Security, Encryption & Authentication

* **Master Passphrase & Key Derivation:**
* Client-side master passphrase protects local storage (`localStorage`/local DB) and account data.
* *Passphrase Recommendation:* Inverse syllabic password generator (matches & suggests recognizable words from entropy/passphrases).


* **PGP & Cryptography Engine:**
* Replaces `openpgp.js` with **Forge** for web-based cryptosystems and direct socket handling.
* Automatic generation of revocation certificates by default; client alerts user upon key revocation detection.
* Simplified trust management UX (option to default to Enigmail-style interface or a simplified trust score).
* Uniform handling and unified display for both plaintext-signed and fully encrypted PGP messages.


* **Server-Assisted Key & Session Management:**
* Key salts/passwords stored server-side, released only upon valid login.
* Challenge-response session setup: Server encrypts session token with client's public key; client decrypts with private key and responds to authenticate.
* Device & Key Management: Revokable Client IDs allow remote deauthentication and "kill-switch" triggers if a device or private key is compromised.


* **Identity & Authentication Standards:**
* Full S/MIME ([RFC 5751](https://tools.ietf.org/html/rfc5751)) and DKIM Signature validation ([RFC 4871](https://tools.ietf.org/html/rfc4871)).
* OAuth / OpenID support; evaluation of client-as-OAuth-server model to issue scoped proxy tokens for relaying.



---

## 2. Architecture & Worker Processing

```
+-------------------------------------------------------------------+
|                           Browser UI                              |
|   (Main Window, Pop-out Message/Contact/Key Windows, UI Queue)    |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|                        Web Worker Layer                           |
|  - Auth & Google Closure Compiled Core                             |
|  - Local Indexing & Search Engine                                 |
|  - Background Decryption & Buffer Management                      |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|                      Local Storage / Cache                        |
|             (Encrypted local DB + appCache offline)               |
+-------------------------------------------------------------------+
                                  │
              (Proxied WebSockets / Non-HTTP protocols)
                                  ▼
+-------------------------------------------------------------------+
|                   Node.js + MongoDB Proxy Server                  |
|          (High-bandwidth relay, mail caching, spam scoring)       |
+-------------------------------------------------------------------+

```

* **Web Worker Threading:**
* Offloads heavy PGP operations, Google Auth, MIME parsing, and local indexing off the main UI thread.
* Priority-queued processing: User-initiated actions (e.g., clicking a message) preempt background synchronization.


* **UI & Window Management:**
* Pop-out windows for emails, contacts, folders, and key management via a central window manager queue.
* Contextual navigation (e.g., clicking a sender name on an open email triggers "Load more messages by this user").


* **Local Storage & Offline First:**
* Offline availability via `appCache` and local IndexedDB/file database.
* Real-time search-as-you-type using the local database, seamlessly falling back to server-side search upon submit.
* Ephemeral Settings Sync: Encrypts configuration with a single-use key to upload to the server; deleted immediately once fetched by the client.



---

## 3. Core Mail Engine & Protocols

* **Protocol Support:**
* Full IMAP SPECIAL-USE mailbox extension support ([RFC 6154](https://tools.ietf.org/html/rfc6154)).
* Newsgroup reader module designed with an Outlook-style layout.
* Dedicated Node.js + MongoDB backend serving as a high-bandwidth/high-RAM protocol proxy for traditional mail servers.
* Native `<name>@fumail.me` domain addressing support.


* **MIME, Rendering & Composing:**
* Async MIME parser (`parseMime`): Fetches email structure first (similar to `imap_fetchstructure()`), loading message bodies via callbacks with visual loading states.
* Direct file drag-and-drop attachment handling with upload/download progress bars for large decrypted payloads.
* Colored nested reply blocks (Thunderbird style).
* Sanitation fix: Strips copied `style` attributes from rich-text editor parent containers.



---

## 4. Extensions, Security & Spam Protection

* **Sandboxed Plugin Architecture:**
* Plugins delivered as cryptographically signed JavaScript or URL packages.
* Runs inside isolated Web Workers; permissions restricted based on capabilities declared inside the signature manifest.
* Security check using `navigator.plugins` to detect malicious environment extensions.


* **Spam & Web of Trust:**
* Hybrid SpamBayes filter combined with shared server-side spam signatures.
* Visual trust indicator badges displayed along the left margin of the message list.
* Trust-network social graph based on PGP key signatures and verification history.



---

## 5. Integrations & Extras

* **Calendar:** Integrated CalDAV calendar populated via Google Calendar sync.
* **Cloud Storage:** Native Dropbox integration for storing and sharing encrypted files.
* **Hardening:**
* Robust buffer and stream management to prevent memory exhaustion in legacy PHP/JS wrappers.
* Standardized key-handlers (e.g., universal Enter key handling on login forms).
* SMTP protocol proposal: Prevent premature user-existence failure responses during SMTP auth to thwart OWASP user-enumeration/brute-force attacks.
