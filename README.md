<div align="center">
  <img src="src-tauri/icons/128x128@2x.png" alt="Termizen Logo" width="120" style="border-radius: 24px">
  <h1>Termizen</h1>
  <h3>High-performance terminal multiplexer, SSH vault, and real-time VPS operations cockpit for Windows.</h3>
  <p>
    <img src="https://img.shields.io/badge/WINDOWS-10%20%2F%2011-2ecc71?style=flat&logo=windows&logoColor=white" alt="Windows 10/11">
    <img src="https://img.shields.io/badge/TAURI_V2-0078d7?style=flat&logo=tauri&logoColor=white" alt="Tauri v2">
    <img src="https://img.shields.io/badge/RUST-00a4e4?style=flat&logo=rust&logoColor=white" alt="Rust">
    <img src="https://img.shields.io/badge/MICA_DESIGN-a5d8ea?style=flat&logo=windows11&logoColor=black" alt="Mica Design">
    <br>
    <img src="https://img.shields.io/badge/REACT_19-5a7d18?style=flat&logo=react&logoColor=white" alt="React 19">
    <img src="https://img.shields.io/badge/TYPESCRIPT-b08800?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
    <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-MIT-ffea00?style=flat&logoColor=black" alt="MIT License"></a>
    <a href="https://github.com/shuaib-07/termizen/releases"><img src="https://img.shields.io/github/downloads/shuaib-07/termizen/total?style=flat&color=005d68" alt="Downloads"></a>
    <br>
    <a href="https://github.com/shuaib-07/termizen/releases"><img src="https://img.shields.io/github/v/release/shuaib-07/termizen?style=flat&color=6a0080&logo=github&logoColor=white" alt="Release"></a>
    <a href="https://github.com/shuaib-07/termizen/stargazers"><img src="https://img.shields.io/github/stars/shuaib-07/termizen?style=flat&color=9c27b0&logo=github&logoColor=white" alt="Stars"></a>
  </p>
</div>

Termizen is an open-source, local-first terminal multiplexer, secure SSH vault, and real-time server command center crafted natively for Windows. It combines multi-pane terminal emulation, live hardware telemetry, web traffic analysis, and multi-service log streaming into a single, GPU-accelerated Windows 11 Mica interface.

All connection profiles, private keys, and server secrets are encrypted on-device using authenticated AES-256-GCM, with zero telemetry or cloud dependencies.

- Repository: [https://github.com/shuaib-07/termizen](https://github.com/shuaib-07/termizen)
- Releases: [https://github.com/shuaib-07/termizen/releases](https://github.com/shuaib-07/termizen/releases)
- Issues: [https://github.com/shuaib-07/termizen/issues](https://github.com/shuaib-07/termizen/issues)
- License: [LICENSE](LICENSE)

## Download Termizen

Open the [latest release page](https://github.com/shuaib-07/termizen/releases/latest), then download the package that matches your system:

| Platform | Package | Note |
| :-- | :-- | :-- |
| **Windows 10/11 (x64 Installer)** | `Termizen_0.1.0_x64-setup.exe` | Guided NSIS installer with desktop and Start Menu shortcuts |
| **Windows 10/11 (x64 MSI)** | `Termizen_0.1.0_x64_en-US.msi` | Windows Installer package for enterprise deployment |

Unsigned binary — if Windows SmartScreen displays a warning on first launch, click **More info** then **Run anyway**.

## Screenshots

<p align="center">
  <img src="screenshots/server_manager.png" alt="Termizen Server Manager" width="900">
  <img src="screenshots/status_charts.png" alt="Termizen Live Status Charts" width="900">
  <img src="screenshots/web_traffic.png" alt="Termizen Web Traffic Analytics" width="900">
  <img src="screenshots/live_logs.png" alt="Termizen Live Service Logs" width="900">
  <img src="screenshots/add_server_modal.png" alt="Termizen Add Server and Key Vault" width="900">
  <img src="screenshots/settings_mica.png" alt="Termizen Settings and Appearance" width="900">
</p>

## Why Termizen

- **Built for freelance workflows**: As a freelance developer maintaining web applications, databases, and VPS infrastructure for clients and personal projects, existing tools required constant context-switching between PuTTY/PowerShell, web hosting panels, and manual terminal log tails. Termizen puts live hardware stats, real-time log tails, and instant SSH access in a single, fast desktop application. Automation features are actively planned to streamline ongoing maintenance.
- **Modern Windows 11 Mica design & fluid animations**: Native OS-composited DWM Mica dark material, rounded-corner container hierarchy, zero artificial glow, and physics-based Framer Motion spring interactions.
- **Agentless live monitoring**: CPU per-core distribution, memory allocation, disk partitions, and network throughput streamed directly over SSH without installing background agents on remote servers.
- **Hardware-encrypted Key Vault**: Local SQLite storage protected with authenticated AES-256-GCM encryption for private keys and connection secrets.
- **Local-first and private**: No forced cloud account, no telemetry, and zero tracking.

## Features

- **Multi-pane terminal multiplexer** with horizontal and vertical 50/50 splits, xterm.js canvas rendering, and portable-pty.
- **Real-time server telemetry** graphing CPU cores, memory/swap, disk partition usage, and network I/O.
- **Web traffic analytics** parsing Nginx and Apache access logs live with status code breakdowns, top endpoints, request velocity, and client IPs.
- **Service log streaming** with auto-discovery for PM2 apps, Docker containers, and systemd services with ANSI color rendering.
- **Macro automation** supporting PTY and background exec scripts with halt-on-error policies and per-profile scoping.
- **Theme and accent personalization** featuring Windows 11 Mica material and custom accent color selection.

## Inspiration & Acknowledgements

Termizen draws inspiration from [lollipopkit/flutter_server_box](https://github.com/lollipopkit/flutter_server_box) (ServerBox) for modern server operations, bringing that unified vision natively to Windows with a modern Mica desktop design.

## License

This project is open-source under the [MIT License](LICENSE).
