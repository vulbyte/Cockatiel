use crossterm::{
    cursor,
    terminal::{self, ClearType},
    ExecutableCommand,
};

use lib_cockatiel::{container::Payload, CockatielClient};

use std::io::{self, Write};

use std::sync::Arc;

use tokio::sync::mpsc;
use tokio::sync::Mutex;

use tracing::{error, Level};

use tracing_subscriber::FmtSubscriber;

#[derive(Clone, Debug)]

struct ChatMessageItem {
    username: String,

    platform: String,

    role_letter: Option<String>,

    content: String,
}

/// Tracks internal state we want to surface to the user via the status bar.
#[derive(Clone, Debug)]
struct AppStatus {
    connected: bool,
    detail: String,
}

impl Default for AppStatus {
    fn default() -> Self {
        Self {
            connected: true,
            detail: "connected to cockatiel engine".to_string(),
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Suppress regular tracing output to stdout so it doesn't mess up the TUI

    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::WARN)
        .finish();

    tracing::subscriber::set_global_default(subscriber).unwrap();

    // Connect to Cockatiel engine as an output/post-processing consumer

    let cockatiel = CockatielClient::connect("term-chat-rs")
        .position("postprocess")
        .connect()
        .await?;

    let messages: Arc<Mutex<Vec<ChatMessageItem>>> = Arc::new(Mutex::new(Vec::new()));

    let messages_clone = messages.clone();

    let status: Arc<Mutex<AppStatus>> = Arc::new(Mutex::new(AppStatus::default()));

    let status_clone = status.clone();

    // Spawn listener for incoming engine events
    tokio::spawn(async move {
        if let Err(err_msg) = cockatiel
            .receive(move |container| {
                let msgs_ref = messages_clone.clone();

                if let Some(payload) = &container.payload {
                    let (platform, content, username) = match payload {
                        Payload::MessagePostProcess(pp) => (
                            pp.platform.clone(),
                            if !pp.processed_message.is_empty() {
                                pp.processed_message.clone()
                            } else {
                                pp.raw_message.clone()
                            },
                            if !pp.user_uuid.is_empty() {
                                pp.user_uuid.clone()
                            } else {
                                "UnknownUser".to_string()
                            },
                        ),
                        Payload::MessagePreProcess(pre) => (
                            pre.platform.clone(),
                            pre.raw_message.clone(),
                            "UnknownUser".to_string(),
                        ),
                        _ => return, // Ignore other payload types
                    };

                    let item = ChatMessageItem {
                        username,
                        platform,
                        role_letter: None,
                        content,
                    };

                    let runtime = tokio::runtime::Handle::current();
                    runtime.spawn(async move {
                        let mut guard = msgs_ref.lock().await;
                        guard.push(item);
                        if guard.len() > 100 {
                            guard.remove(0);
                        }
                    });
                }
            })
            .await
            // Turn the error into an owned String immediately, synchronously,
            // right here. This is what actually keeps the non-Send
            // Box<dyn Error> from ever being part of the state this future
            // has to carry across the status-mutex await below -- calling
            // drop() on it further down isn't reliably enough for every
            // rustc/tokio version to prove that on its own.
            .map_err(|e| e.to_string())
        {
            error!("Terminal display receiver error: {}", err_msg);

            let mut status_guard = status_clone.lock().await;
            status_guard.connected = false;
            status_guard.detail = format!("disconnected from engine: {}", err_msg);
        }
    });

    // Enter alternate screen and setup terminal interface

    let mut stdout = io::stdout();

    stdout.execute(terminal::EnterAlternateScreen)?;

    terminal::enable_raw_mode()?;

    let result = run_tui(&mut stdout, messages, status).await;

    // Restore terminal state on exit

    terminal::disable_raw_mode()?;

    stdout.execute(terminal::LeaveAlternateScreen)?;

    if let Err(err) = result {
        eprintln!("Error in terminal display: {}", err);
    }

    Ok(())
}

/// A message resolved to what will actually be printed for it: the bit
/// inside the brackets, and the (possibly truncated) content.
struct RenderedLine {
    bracket_content: String,
    content: String,
}

async fn run_tui(
    stdout: &mut io::Stdout,

    messages: Arc<Mutex<Vec<ChatMessageItem>>>,

    status: Arc<Mutex<AppStatus>>,
) -> Result<(), Box<dyn std::error::Error>> {
    // crossterm::event::read() blocks the OS thread until an event arrives,
    // so it's given its own dedicated blocking thread and forwards what it
    // reads back to this async loop over a channel. That's what lets a
    // terminal resize (or keypress) be reacted to the instant it happens,
    // instead of the old approach of only checking for one event every time
    // a 100ms tick fired.
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<crossterm::event::Event>();

    tokio::task::spawn_blocking(move || loop {
        match crossterm::event::read() {
            Ok(ev) => {
                if event_tx.send(ev).is_err() {
                    break; // Receiving end dropped, TUI is shutting down
                }
            }
            Err(_) => break,
        }
    });

    // Interval is now just a "redraw at least this often" fallback, e.g. to
    // pick up newly arrived chat messages even if the terminal itself is
    // untouched. Resize/key events short-circuit this via `select!` below.
    let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(250));

    let mut needs_redraw = true; // Draw once immediately on startup

    loop {
        tokio::select! {
            _ = interval.tick() => {
                needs_redraw = true;
            }
            maybe_event = event_rx.recv() => {
                match maybe_event {
                    Some(crossterm::event::Event::Key(key)) => {
                        if key.code == crossterm::event::KeyCode::Char('c')
                            && key
                                .modifiers
                                .contains(crossterm::event::KeyModifiers::CONTROL)
                        {
                            break;
                        }

                        if key.code == crossterm::event::KeyCode::Char('q') {
                            break;
                        }
                    }
                    Some(crossterm::event::Event::Resize(_, _)) => {
                        // Terminal dimensions changed -- recalculate and
                        // redraw right away using the new size below.
                        needs_redraw = true;
                    }
                    Some(_) => {} // Ignore mouse/focus/paste events
                    None => break, // Input thread ended unexpectedly
                }
            }
        }

        if !needs_redraw {
            continue;
        }

        needs_redraw = false;

        let (cols, rows) = terminal::size()?;

        if cols < 10 || rows < 6 {
            continue;
        }

        let cols_usize = cols as usize;

        // Redraw screen

        stdout.execute(cursor::MoveTo(0, 0))?;

        stdout.execute(terminal::Clear(ClearType::All))?;

        // 1. Top of the window: Header

        let header = " Cockatiel Term Chat Display ";

        let padded_header = format!("{:^width$}", header, width = cols_usize);

        print!("\x1b[44m\x1b[37m{}\x1b[0m\r\n", padded_header);

        // 2. Middle: Chat messages area
        //
        // Reserved rows: Header (1) + Status bar (1) + Footer (1).
        // Everything else is available for messages.

        let current_msgs = messages.lock().await;

        let max_chat_rows = (rows as usize).saturating_sub(3);

        // Walk backwards from the newest message, working out how many
        // terminal rows each one will actually take (long messages wrap,
        // and we now add a blank spacer row after every message), and stop
        // as soon as the budget is used up. Without this, a run of long or
        // numerous messages could print more lines than the screen has
        // room for, which is what let the header scroll off the top over
        // time.
        let mut selected: Vec<RenderedLine> = Vec::new();

        let mut used_rows = 0usize;

        for msg in current_msgs.iter().rev() {
            let pl_code: String = if msg.platform.chars().count() > 2 {
                msg.platform.chars().take(2).collect() // ie: discord -> di
            } else {
                msg.platform.clone()
            };

            let bracket_content = if let Some(role) = &msg.role_letter {
                format!("{} | {} | {}", msg.username, pl_code, role)
            } else {
                format!("{} | {}", msg.username, pl_code)
            };

            let plain_line = format!("[{}]: {}", bracket_content, msg.content);

            let visible_len = plain_line.chars().count().max(1);

            let wrapped_rows = (visible_len + cols_usize - 1) / cols_usize.max(1);

            let rows_needed = wrapped_rows + 1; // +1 for the spacer line after it

            if used_rows + rows_needed > max_chat_rows {
                // This message doesn't fit in what's left of the budget.
                // If nothing has been selected yet, it means even the
                // single newest message is taller than the whole message
                // area on its own -- truncate it so it still fits, rather
                // than letting it push everything else off-screen.
                if selected.is_empty() && max_chat_rows > 1 {
                    // Rows available for the wrapped text itself, after
                    // reserving one row for the spacer line beneath it.
                    let content_area_rows = max_chat_rows - 1;

                    let max_visible_chars = cols_usize.saturating_mul(content_area_rows).max(1);

                    let prefix = format!("[{}]: ", bracket_content);

                    let prefix_len = prefix.chars().count();

                    let content_budget = max_visible_chars.saturating_sub(prefix_len).max(1);

                    let truncated_content: String = msg
                        .content
                        .chars()
                        .take(content_budget.saturating_sub(1))
                        .collect();

                    selected.push(RenderedLine {
                        bracket_content: bracket_content.clone(),
                        content: format!("{}…", truncated_content),
                    });
                }

                break;
            }

            used_rows += rows_needed;

            selected.push(RenderedLine {
                bracket_content,
                content: msg.content.clone(),
            });
        }

        selected.reverse(); // Back to chronological order (oldest visible first)

        let color_code = "\x1b[35m";

        for line in &selected {
            print!(
                "{}[{}]\x1b[0m: \x1b[37m{}\x1b[0m\r\n\r\n",
                color_code, line.bracket_content, line.content
            );
        }

        // 3. Status bar: internal state, one row above the footer
        //
        // Built as: a leading space, a colored connection dot, then the
        // rest of the text -- all on a shared gray background that's set
        // once and only reset (\x1b[0m) at the very end, so switching the
        // foreground color for the dot doesn't disturb it.

        let status_guard = status.lock().await;

        let dot_color = if status_guard.connected {
            "\x1b[32m" // green
        } else {
            "\x1b[31m" // red
        };

        let rest_text = format!(
            " {} | {} messages buffered | {}x{} ",
            status_guard.detail,
            current_msgs.len(),
            cols,
            rows
        );

        drop(status_guard);
        drop(current_msgs);

        // Reserve 2 visible columns for the leading space + dot, fit/pad the rest into what's left.
        let avail_for_rest = cols_usize.saturating_sub(2);

        let mut rest_chars: Vec<char> = rest_text.chars().collect();

        if rest_chars.len() > avail_for_rest {
            rest_chars.truncate(avail_for_rest);
        } else {
            rest_chars.resize(avail_for_rest, ' ');
        }

        let rest_str: String = rest_chars.into_iter().collect();

        stdout.execute(cursor::MoveTo(0, rows.saturating_sub(2)))?;

        print!(
            "\x1b[100m\x1b[37m {}●\x1b[37m{}\x1b[0m",
            dot_color, rest_str
        );

        // 4. Bottom of the window: Footer in dark terminal safe gray (\x1b[90m)

        stdout.execute(cursor::MoveTo(0, rows.saturating_sub(1)))?;

        let footer = " press ctrl+c to exit ";

        let padded_footer = format!("{:^width$}", footer, width = cols_usize);

        print!("\x1b[90m{}\x1b[0m", padded_footer);

        stdout.flush()?;
    }

    Ok(())
}