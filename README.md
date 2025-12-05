# Luma

Your personal library server for ebooks and audiobooks.

## Why Luma?

If you've got a collection of EPUBs, PDFs, or audiobooks sitting on your computer, Luma gives you a way to actually enjoy them. Read on your phone during your commute, pick up where you left off on your tablet before bed, or listen in the car—your progress follows you everywhere.

It's like having your own private library that works on any device with a browser. No subscriptions, no cloud services, no sending your reading habits to some company's servers. Just your books, your way.

Luma connects to any Public Domain book catalog source as well as Anna's Archive, Google Books, Calibre, and Open Library.

## What you get

**Reading experience**
- Read EPUBs and PDFs right in your browser
- Bookmark pages, highlight passages, jot down notes
- Adjust fonts and themes until it feels right
- Built-in dictionary for quick lookups
- Text-to-speech when your eyes need a break

**Audiobook player**
- Jump between chapters easily
- Sleep timer for bedtime listening
- Speed controls from 0.5x to 3x
- Car mode with bigger buttons for safer driving
- Handles both single M4B files and folders of MP3s

**Library tools**
- Pulls metadata straight from your files
- Grabs cover art automatically
- Organize by collections or series
- Search and filter your whole library
- Import your existing Calibre library without losing metadata
- Download books through Anna's Archive integration

**Extras**
- Set up accounts for family members
- Create book clubs with discussion threads
- Track your reading goals
- Send books to your Kindle via email
- Dark mode and nine color themes
- Works great on phones and tablets

## What files it handles

**Ebooks:** EPUB, PDF, MOBI, CBZ, CBR  
**Audiobooks:** M4B, MP3, M4A

## Getting started

The easiest way to run Luma is with Docker. If you're not familiar with Docker, think of it as a way to run software in its own contained environment—you don't have to worry about dependencies or configuration conflicts.

**Basic setup:**

```bash
docker run -d \
  --name luma \
  -p 5000:5000 \
  -v /path/to/your/data:/data \
  -e SESSION_SECRET="$(openssl rand -base64 32)" \
  --restart unless-stopped \
  netpersona/luma:latest
```

Replace `/path/to/your/data` with wherever you want Luma to store its files. Then open `http://localhost:5000` in your browser and create your account.

**Using Docker Compose:**

Create a file called `docker-compose.yml`:

```yaml
services:
  luma:
    image: netpersona/luma:latest
    container_name: luma
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - ./luma-data:/data
    environment:
      - SESSION_SECRET=change-this-to-something-random
```

Then run:

```bash
docker-compose up -d
```

**On Unraid:**

Just search for "Luma" in Community Applications. The template's already set up for you.

## Optional configuration

You only need to set `SESSION_SECRET` (a random string for security). Everything else is optional:

- `GOOGLE_BOOKS_API_KEY` - Enables book recommendations
- `SENDGRID_API_KEY` or `RESEND_API_KEY` - For sending books to Kindle

## What gets stored where

Everything lives in the `/data` folder you mounted:

```
/data
├── luma.db          # Your database
├── books/           # Ebooks
├── audiobooks/      # Audiobooks
├── covers/          # Cover images
└── settings.json    # App preferences
```

Back up this folder and you've backed up everything.

## Getting your books into Luma

**Upload directly:** There's an upload button in the library view. Simple as that.

**Scan folders:** Go to Settings → Library Scanner, tell it where your books are, and let it import everything automatically.

**Import from Calibre:** Point the scanner at your Calibre library folder. It'll bring everything over with metadata intact.

**Download from Anna's Archive:** Built-in search lets you find and download books. You'll occasionally need to solve a captcha, but it beats hunting around different websites.

## Setting up for multiple people

Luma handles multiple users, each with their own library and reading progress.

1. As admin, create invite codes in Settings → User Management
2. Give the code to whoever you want to add
3. They sign up with it

You can also enable Google OAuth if you want easier logins (people still need an invite code to get in the first time).

## Updating

Pull the latest version and restart:

```bash
docker pull netpersona/luma:latest
docker-compose up -d
```

On Unraid, just click "Check for Updates" in the Docker tab.

## If something goes wrong

**Container won't start?**  
Check the logs: `docker logs luma`

**Permission errors?**  
Fix ownership: `chown -R 1000:1000 /path/to/luma-data`

**Database locked?**  
Make sure you're not running two instances of Luma at once. SQLite gets cranky with multiple writers.

**Books not showing up?**  
Verify the file format is supported and the files aren't corrupted. Check the logs for details.

## Building from source

If you want to run Luma without Docker or modify the code:

```bash
git clone https://github.com/netpersona/luma.git
cd luma
npm install
npm run build
npm start
```

For development: `npm run dev`

## Contributing

Found a bug? Got an idea? Open an issue on GitHub. Pull requests welcome, just open an issue first for bigger changes so we can discuss the approach.

