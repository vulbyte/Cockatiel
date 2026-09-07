use std::io::{self, Stdout};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crossterm::{
    event::{self, Event, KeyCode, KeyEvent, KeyModifiers, MouseButton, MouseEventKind},
    execute,
    terminal::{EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode},
};

use ratatui::{
    Terminal,
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::Line,
    widgets::{Block, Borders, List, ListItem, ListState, Paragraph, Wrap},
};

use crate::{EngineCommand, EngineState, ModuleState};

pub struct Tui {
    terminal: Terminal<CrosstermBackend<Stdout>>,
    selected: usize,
    should_quit: bool,

    keymap: Keymap,
}

let keymap = Keymap::load("keymap.json");

impl Tui {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        enable_raw_mode()?;

        let mut stdout = io::stdout();

        execute!(stdout, EnterAlternateScreen)?;

        let backend = CrosstermBackend::new(stdout);
        let terminal = Terminal::new(backend)?;

        Ok(Self {
            terminal,
            list_state: ListState::default(),
            selected: 0,
            should_quit: false,
            timeline: Vec::new(), // Add this field
        })
    }

    pub fn run(
        &mut self,
        state: Arc<Mutex<EngineState>>,
        command_tx: std::sync::mpsc::Sender<EngineCommand>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        while !self.should_quit {
            self.draw(&state)?;

            if event::poll(Duration::from_millis(100))? {
                let event = event::read()?;

                match event {
                    Event::Key(key) => {
                        self.handle_key(key, &state, &command_tx)?;
                    }

                    Event::Mouse(mouse) => {
                        self.handle_mouse(
                            mouse.kind,
                            mouse.column,
                            mouse.row,
                            &state,
                            &command_tx,
                        )?;
                    }

                    Event::Resize(_, _) => {}

                    _ => {}
                }
            }
        }

        Ok(())
    }

    fn draw(&mut self, state: &Arc<Mutex<EngineState>>) -> Result<(), Box<dyn std::error::Error>> {
        let state = state.lock().unwrap();

        let modules = state.modules.clone();
        let timeline = state.timeline.clone();

        // In src/tui.rs around line 90:
        let list_state = &mut self.list_state;
        // Extract any other fields you need here...

        self.terminal.draw(|frame| {
            let size = frame.area();
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(3), // Header area
                    Constraint::Min(1),    // Timeline list area
                ])
                .split(size);

            // Render header block
            let header =
                Paragraph::new("Cockatiel Engine").block(Block::default().borders(Borders::ALL));
            frame.render_widget(header, chunks[0]);

            // Convert your timeline vector into ListItems

            let items: Vec<ListItem> = self
                .timeline
                .iter()
                .map(|event| ListItem::new(event.p.clone())) // Using field `p` (processed message)
                .collect();

            let timeline_list = List::new(items)
                .block(Block::default().borders(Borders::ALL).title("Timeline"))
                .highlight_style(Style::default().add_modifier(Modifier::REVERSED));

            // Render stateful list
            frame.render_stateful_widget(timeline_list, chunks[1], &mut self.list_state);
        })?;

        Ok(())
    }

    fn draw_header(&self, frame: &mut ratatui::Frame, area: Rect) {
        let art = vec![
            "                         X",
            "                 XXXXXXXXX     XXX",
            "              XXXXXXXXXXXXXXXXX",
            "            XX    XXXXXXXXXXXX",
            "         XXXX      XXXXXXXXXXXXXX",
            "        XXXXXX    XXXXXXXXXXX",
            "         XXXXXXXXXXXXXXXXX",
            "           XXXXXXXXXXXXXXX",
            "           XXX XXXXXXX XXX",
            "           XX    XXXX    XX",
            "           cockatiel",
            "              -by vulbyte",
        ];

        let widget = Paragraph::new(art.into_iter().map(Line::from).collect::<Vec<_>>())
            .block(Block::default().borders(Borders::ALL).title(" Cockatiel "));

        frame.render_widget(widget, area);
    }

    fn draw_details(
        &self,
        frame: &mut ratatui::Frame,
        area: Rect,
        module: Option<&crate::ModuleInfo>,
    ) {
        let Some(module) = module else {
            return;
        };

        let inner = Rect {
            x: area.x + 2,
            y: area.y + 2,
            width: area.width.saturating_sub(4),
            height: area.height.saturating_sub(4),
        };

        let status = match module.state {
            ModuleState::Running => "RUNNING",
            ModuleState::Paused => "PAUSED",
            ModuleState::Stopped => "STOPPED",
            ModuleState::Crashed => "CRASHED",
        };

        let text = vec![
            Line::from(format!("{} {}", status, module.name)),
            Line::from(""),
            Line::from(format!("Instance: {}", module.instance_uuid7)),
            Line::from(format!("Position: {}", module.process_position)),
            Line::from(format!("Priority: {}", module.priority)),
            Line::from(""),
            Line::from("[Enter] actions   [i] details   [q] quit"),
        ];

        frame.render_widget(
            Paragraph::new(text)
                .block(
                    Block::default()
                        .borders(Borders::ALL)
                        .title(" Module Details "),
                )
                .wrap(Wrap { trim: true }),
            inner,
        );
    }

    fn handle_key(
        &mut self,
        key: KeyEvent,
        state: &Arc<Mutex<EngineState>>,
        command_tx: &std::sync::mpsc::Sender<EngineCommand>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        match key.code {
            KeyCode::Char('q') => {
                self.should_quit = true;
            }

            KeyCode::Esc => {
                self.should_quit = true;
            }

            KeyCode::Up | KeyCode::Char('k') => {
                self.move_selection(-1, state);
            }

            KeyCode::Down | KeyCode::Char('j') => {
                self.move_selection(1, state);
            }

            KeyCode::Char('h') => {
                self.move_selection(-1, state);
            }

            KeyCode::Char('l') => {
                self.move_selection(1, state);
            }

            KeyCode::Enter => {
                if let Some(module) = self.selected_module(state) {
                    let _ =
                        command_tx.send(EngineCommand::OpenModuleActions(module.instance_uuid7));
                }
            }

            KeyCode::Char('p') => {
                if let Some(module) = self.selected_module(state) {
                    let _ = command_tx.send(EngineCommand::TogglePause(module.instance_uuid7));
                }
            }

            KeyCode::Char('r') => {
                if let Some(module) = self.selected_module(state) {
                    let _ = command_tx.send(EngineCommand::Restart(module.instance_uuid7));
                }
            }

            KeyCode::Char('s') => {
                if let Some(module) = self.selected_module(state) {
                    let _ = command_tx.send(EngineCommand::Shutdown(module.instance_uuid7));
                }
            }

            KeyCode::Char('i') => {
                if let Some(event) = state.lock().unwrap().timeline.last().cloned() {
                    let _ = command_tx.send(EngineCommand::InspectTimeline(event.id));
                }
            }

            KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.should_quit = true;
            }

            _ => {}
        }

        Ok(())
    }

    fn handle_mouse(
        &mut self,
        kind: MouseEventKind,
        column: u16,
        row: u16,
        state: &Arc<Mutex<EngineState>>,
        command_tx: &std::sync::mpsc::Sender<EngineCommand>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if !matches!(kind, MouseEventKind::Down(MouseButton::Left)) {
            return Ok(());
        }

        let state = state.lock().unwrap();

        let modules = &state.modules;

        if modules.is_empty() {
            return Ok(());
        }

        // Module list occupies the right side.
        // The left side is the logo.
        if column < 34 {
            return Ok(());
        }

        let index = row.saturating_sub(2) as usize;

        if index < modules.len() {
            self.selected = index;

            let _ = command_tx.send(EngineCommand::OpenModuleActions(
                modules[index].instance_uuid7.clone(),
            ));
        }

        Ok(())
    }

    fn move_selection(&mut self, direction: i32, state: &Arc<Mutex<EngineState>>) {
        let count = state.lock().unwrap().modules.len();

        if count == 0 {
            self.selected = 0;
            return;
        }

        if direction < 0 {
            if self.selected == 0 {
                self.selected = count - 1;
            } else {
                self.selected -= 1;
            }
        } else {
            self.selected = (self.selected + 1) % count;
        }
    }

    fn selected_module(&self, state: &Arc<Mutex<EngineState>>) -> Option<crate::ModuleInfo> {
        state.lock().unwrap().modules.get(self.selected).cloned()
    }
}

impl Drop for Tui {
    fn drop(&mut self) {
        let _ = disable_raw_mode();

        let _ = execute!(self.terminal.backend_mut(), LeaveAlternateScreen);

        let _ = self.terminal.show_cursor();
    }
}
