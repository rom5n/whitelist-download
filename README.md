# 🌊 whitelist-download
<div align="center">
  <p align="center">
    <img src="https://img.shields.io/github/stars/rom5n/whitelist-download?style=for-the-badge&color=gold&logo=github" />
    <img src="https://img.shields.io/github/last-commit/rom5n/whitelist-download?style=for-the-badge&color=green" />
    <img src="https://img.shields.io/badge/Configs-3800+-orange?style=for-the-badge&logo=serverless" />
  </p>

**Автоматический агрегатор VLESS-конфигов и локальный сервер подписок.**

*Ваш локальный сервер конфигов*
</div>

---

### 📖 О проекте

Скрипт предназначен для автоматического сбора бесплатных **VLESS-конфигов** из проверенных GitHub-репозиториев. Он объединяет тысячи серверов в одну компактную ссылку-подписку (Subscription link), которую "понимает" любой современный VPN-клиент.

> [!IMPORTANT]
> **3800+ актуальных конфигураций** обновляются каждый час в автоматическом режиме.

---

### ✨ Основные возможности

- 🔄 **Auto-Update:** Свежие конфиги каждый час без вашего участия.
- 🌐 **Local Server:** Поднимает HTTP-сервер на порту `55000` для раздачи подписки.
- 🪟 **Windows Stealth:** Автоматическая пропись в реестр и тихий запуск при старте системы.
- 🧪 **Smart Filtering:** Умное управление лимитами (`/sub/50` или `/sub/10-30`), чтобы не перегружать клиент.
- 🛡️ **Bypass:** Эффективный обход блокировок через актуальные "белые списки".

---

### ⚠️ Важные примечания

> [!WARNING]
> Ссылка на подписку может не работать в мобильной версии **v2RayTun** из-за особенностей обработки локальных адресов приложением.

> [!CAUTION]
> Иногда антивирус (Windows Defender) может выдавать предупреждение при первом запуске, так как программа работает с сетью и реестром (автозагрузка).

---

### 🚀 Быстрый старт

#### 1. Установка (Windows)
1. Скачайте свежий `wl-download.exe`.
2. Положите его в отдельную папку (например, `C:\Tools\VPN`).
3. Запустите. Программа сама создаст `configs.txt` и `log.txt`.

#### 2. Подключение в клиент
1. Откройте `log.txt`.
2. Скопируйте ссылку вида: `http://ВАШ_IP:55000/sub`.
3. Вставьте её в ваш клиент (**v2rayN**, **Nekobox**, **Hiddify**, **v2rayNG**).

> [!TIP]
> Если ссылка не работает, проверьте ваш IPv4-адрес в настройках сети Windows и убедитесь, что телефон и ПК находятся в одной Wi-Fi сети, а так же на телефоне выключены все VPN/VLESS (после импорта подписки их можно снова включить).

---

### ⚙️ Параметры ссылки

Вы можете гибко управлять списком серверов через URL:

| Ссылка | Результат |
| :--- | :--- |
| `/sub` | Импорт **всех** доступных конфигов |
| `/sub/50` | Только первые **50** штук |
| `/sub/10-30` | Начиная с 10 (включительно) взять следующие **30** |

---

### 📂 Файлы

- 📄 `configs.txt` — Ваша локальная база конфигов. Перезаписывается каждый час.
- 📝 `log.txt` — История работы, ошибки и ваш персональный адрес подписки.
- ⚙️ `wl-download.exe` — Основной бинарный файл. **Не перемещайте его после запуска!**. Если все же нужно переместить, то найдите в диспетчере задач процесс 'wl-download.exe' и завершите его, после переместите файл в новое место и запустите его.

---

### 👀 Статистика репозитория
<div align="center">

![Visitors](https://api.visitorbadge.io/api/visitors?path=rom5n.whitelist-download&label=Visitors&labelColor=%23555555&countColor=%23007ec6)
![Cyber Hits](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2From5n%2Fwhitelist-download&count_bg=%238cc600&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=Cyber+Hits&edge_flat=false)

<br />

<a href="https://star-history.com/#rom5n/whitelist-download&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=rom5n/whitelist-download&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=rom5n/whitelist-download&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=rom5n/whitelist-download&type=Date" width="600" />
  </picture>
</a>
</div>

---

### 🔗 Источники конфигураций

Проект агрегирует данные из следующих открытых источников:
- [zieng2/wl](https://github.com/zieng2/wl)
- [igareck/vpn-configs-for-russia](https://github.com/igareck/vpn-configs-for-russia)
- [whoahaow/rjsxrd](https://github.com/whoahaow/rjsxrd)
