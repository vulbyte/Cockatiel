use crossterm::{
    cursor,
    terminal::{self, ClearType},
    ExecutableCommand,
};

use lib_cockatiel::{container::Payload, CockatielClient};

use std::io::{self, Write};

use std::sync::Arc;

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

    // Spawn listener for incoming engine events

    // Spawn listener for incoming engine events
    tokio::spawn(async move {
        if let Err(e) = cockatiel
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
        {
            error!("Terminal display receiver error: {}", e);
        }
    });

    // Enter alternate screen and setup terminal interface

    let mut stdout = io::stdout();

    stdout.execute(terminal::EnterAlternateScreen)?;

    terminal::enable_raw_mode()?;

    let result = run_tui(&mut stdout, messages).await;

    // Restore terminal state on exit

    terminal::disable_raw_mode()?;

    stdout.execute(terminal::LeaveAlternateScreen)?;

    if let Err(err) = result {
        eprintln!("Error in terminal display: {}", err);
    }

    Ok(())
}

async fn run_tui(
    stdout: &mut io::Stdout,

    messages: Arc<Mutex<Vec<ChatMessageItem>>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(100));

    loop {
        interval.tick().await;

        // Non-blocking check for user exit (Ctrl+C or 'q')

        if crossterm::event::poll(std::time::Duration::from_millis(10))? {
            if let crossterm::event::Event::Key(key) = crossterm::event::read()? {
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
        }

        let (cols, rows) = terminal::size()?;

        if cols < 10 || rows < 5 {
            continue;
        }

        // Redraw screen

        stdout.execute(cursor::MoveTo(0, 0))?;

        stdout.execute(terminal::Clear(ClearType::All))?;

        // 1. Top of the window: Header

        let header = " Cockatiel Term Chat Display ";

        let padded_header = format!("{:^width$}", header, width = cols as usize);

        print!("\x1b[44m\x1b[37m{}\x1b[0m\r\n", padded_header);

        // 2. Middle: Chat messages area

        let current_msgs = messages.lock().await;

        let max_chat_rows = rows.saturating_sub(3) as usize; // Header (1) + Footer (1) + safety margin (1)

        let start_idx = if current_msgs.len() > max_chat_rows {
            current_msgs.len() - max_chat_rows
        } else {
            0
        };

        let visible_msgs = &current_msgs[start_idx..];

        for msg in visible_msgs {
            // Determine platform 2-letter code and color
            let pl_code = if msg.platform.len() > 2 {
                &msg.platform[0..2] /* ie: discord -> di */
            } else {
                &msg.platform
            };
            let color_code = "\x1b[35m";

            let bracket_content = if let Some(role) = &msg.role_letter {
                format!("{} | {} | {}", msg.username, pl_code, role)
            } else {
                format!("{} | {}", msg.username, pl_code)
            };

            print!(
                "{}[{}]\x1b[0m: \x1b[37m{}\x1b[0m\r\n",
                color_code, bracket_content, msg.content
            );
        }

        // Pad remaining empty rows to push footer to the bottom

        let rendered_rows = visible_msgs.len() + 1; // +1 for header

        for _ in rendered_rows..(rows as usize).saturating_sub(1) {
            print!("\r\n");
        }

        // 3. Bottom of the window: Footer in dark terminal safe gray (\x1b[90m)

        stdout.execute(cursor::MoveTo(0, rows.saturating_sub(1)))?;

        let footer = " press ctrl+c to exit ";

        let padded_footer = format!("{:^width$}", footer, width = cols as usize);

        print!("\x1b[90m{}\x1b[0m", padded_footer);

        stdout.flush()?;
    }

    Ok(())
}
