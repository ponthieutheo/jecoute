//! From timed pieces of speech to the written call: lines, who said them,
//! the echo of the speakers removed from the microphone, and the notes the
//! AI writes about it. Pure functions, nothing here touches the OS.

use std::collections::HashSet;
use std::sync::atomic::{AtomicU32, Ordering};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

/// A short id, unique within the app: milliseconds since 1970 then a counter.
pub fn unique_id() -> String {
    static NEXT: AtomicU32 = AtomicU32::new(0);
    let ms = chrono::Utc::now().timestamp_millis().max(0) as u64;
    let n = NEXT.fetch_add(1, Ordering::Relaxed) % 0x1_0000;
    format!("{ms:x}{n:04x}")
}

/// Someone heard in a call. "me" is the microphone of this computer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Speaker {
    pub id: String,
    pub name: String,
    /// Which of the page's speaker colours.
    pub color: u32,
    #[serde(default)]
    pub is_me: bool,
}

/// What one person said without a long pause.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Line {
    #[serde(default = "unique_id")]
    pub id: String,
    pub speaker: String,
    /// Seconds from the start of the call.
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Todo {
    #[serde(default = "unique_id")]
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub owner: Option<String>,
    #[serde(default)]
    pub due: Option<String>,
    #[serde(default)]
    pub done: bool,
}

/// A stretch where one voice is heard, numbered by the voice separator.
#[derive(Debug, Clone, PartialEq)]
pub struct Turn {
    pub speaker: usize,
    pub start: f64,
    pub end: f64,
}

/// Silence that ends a line, in seconds.
pub const PAUSE: f64 = 1.4;
/// Longest line, in seconds.
pub const LONGEST_LINE: f64 = 40.0;
/// The microphone's label.
pub const ME: &str = "me";
/// The computer's sound when the voices are not told apart.
pub const OTHERS: &str = "others";

/// The names given to the people of a call.
pub struct Names<'a> {
    pub me: &'a str,
    pub others: &'a str,
    pub person: &'a dyn Fn(usize) -> String,
}

fn in_time_order(lines: &mut [Line]) {
    lines.sort_by(|a, b| a.start.total_cmp(&b.start));
}

/// Joins the pieces into lines: a piece goes onto the previous line when the
/// same person goes on after a short pause and the line stays readable.
pub fn group_into_lines(mut pieces: Vec<Line>) -> Vec<Line> {
    in_time_order(&mut pieces);
    pieces
        .into_iter()
        .filter(|p| !p.text.trim().is_empty())
        .fold(Vec::<Line>::new(), |mut lines, piece| {
            let joins = lines.last().is_some_and(|prev| {
                prev.speaker == piece.speaker
                    && piece.start - prev.end < PAUSE
                    && piece.end - prev.start <= LONGEST_LINE
            });
            if joins {
                let prev = lines.last_mut().expect("checked above");
                prev.text = format!("{} {}", prev.text, piece.text.trim());
                prev.end = prev.end.max(piece.end);
            } else {
                lines.push(Line {
                    text: piece.text.trim().to_string(),
                    ..piece
                });
            }
            lines
        })
}

/// The words of a text, lower case, without punctuation.
pub fn words(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(str::to_lowercase)
        .collect()
}

/// Without headphones, the others come out of the speakers and the
/// microphone hears them again. A line of the microphone is that echo when
/// most of its words were said, at the same time, on the computer's sound.
pub fn without_echo(mine: &[Line], theirs: &[Line]) -> Vec<Line> {
    let heard_near = |line: &Line, margin: f64| -> HashSet<String> {
        theirs
            .iter()
            .filter(|t| t.start - margin < line.end && line.start - margin < t.end)
            .flat_map(|t| words(&t.text))
            .collect()
    };
    mine.iter()
        .filter(|line| {
            let own = words(&line.text);
            match own.len() {
                0 => false,
                1 => !heard_near(line, 0.8).contains(&own[0]),
                n => {
                    let near = heard_near(line, 1.5);
                    let repeated = own.iter().filter(|w| near.contains(*w)).count();
                    (repeated as f64) < 0.6 * n as f64
                }
            }
        })
        .cloned()
        .collect()
}

/// Gives every label a speaker, in the order they are first heard. `known`
/// already holds "me" when the microphone speaks; others become p2, p3…
/// (`first_number` = 2) or p1, p2… for a room (`first_number` = 1).
fn name_people(
    lines: Vec<Line>,
    mut known: Vec<Speaker>,
    first_number: usize,
    names: &Names,
) -> (Vec<Speaker>, Vec<Line>) {
    let mut labels: Vec<(String, String)> = Vec::new();
    let mut out = Vec::with_capacity(lines.len());
    for mut line in lines {
        if line.speaker == ME {
            out.push(line);
            continue;
        }
        let id = match labels.iter().find(|(label, _)| *label == line.speaker) {
            Some((_, id)) => id.clone(),
            None => {
                let number = first_number + labels.len();
                let id = format!("p{number}");
                let name = if line.speaker == OTHERS {
                    names.others.to_string()
                } else {
                    (names.person)(number)
                };
                known.push(Speaker {
                    id: id.clone(),
                    name,
                    color: number as u32 % 6,
                    is_me: false,
                });
                labels.push((line.speaker.clone(), id.clone()));
                id
            }
        };
        line.speaker = id;
        out.push(line);
    }
    (known, out)
}

/// A call: the microphone is you, the computer's sound is the others
/// (labelled by the voice separator, or all [`OTHERS`]).
pub fn cast_call(mine: Vec<Line>, theirs: Vec<Line>, names: &Names) -> (Vec<Speaker>, Vec<Line>) {
    let theirs = group_into_lines(theirs);
    let mine = without_echo(&group_into_lines(mine), &theirs);
    let mut known = Vec::new();
    if !mine.is_empty() || theirs.is_empty() {
        known.push(Speaker {
            id: ME.into(),
            name: names.me.into(),
            color: 0,
            is_me: true,
        });
    }
    let mut all: Vec<Line> = mine.into_iter().chain(theirs).collect();
    in_time_order(&mut all);
    name_people(all, known, 2, names)
}

/// People around one computer (no call): everyone is on the microphone,
/// told apart by the voice separator.
pub fn cast_room(pieces: Vec<Line>, names: &Names) -> (Vec<Speaker>, Vec<Line>) {
    name_people(group_into_lines(pieces), Vec::new(), 1, names)
}

/// The call as plain text for the AI, one "Name: words" per line.
pub fn as_plain_text(speakers: &[Speaker], lines: &[Line]) -> String {
    let mut out = String::new();
    for line in lines {
        let name = speakers
            .iter()
            .find(|s| s.id == line.speaker)
            .map_or(line.speaker.as_str(), |s| s.name.as_str());
        if !out.is_empty() {
            out.push('\n');
        }
        out.push_str(name);
        out.push_str(": ");
        out.push_str(&line.text);
    }
    out
}

// ── The notes written by the AI ───────────────────────────────────────────────

/// What the AI wrote about a call.
#[derive(Debug, Clone, PartialEq)]
pub struct Notes {
    pub title: Option<String>,
    pub summary: String,
    pub key_points: Vec<String>,
    pub todos: Vec<Todo>,
}

pub const NOTES_PROMPT: &str = "You receive the transcript of a conversation, one line per turn, written \"Speaker: what they said\".\n\
Take notes of it, in the same language as the conversation. Only use what is in the transcript: no guess, no addition.\n\
Answer with a single JSON object and nothing else:\n\
- \"title\": a few words naming the conversation (6 at most);\n\
- \"summary\": two to four sentences on what was decided, and why;\n\
- \"key_points\": at most six short sentences;\n\
- \"todos\": the tasks agreed on, each {\"text\": the task, \"owner\": who does it (name as in the transcript) or null, \"due\": when, as said, or null}.";

/// The JSON schema of the notes, for providers with structured outputs.
pub fn notes_schema() -> Value {
    let nullable = serde_json::json!({ "type": ["string", "null"] });
    serde_json::json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["title", "summary", "key_points", "todos"],
        "properties": {
            "title": { "type": "string" },
            "summary": { "type": "string" },
            "key_points": { "type": "array", "items": { "type": "string" } },
            "todos": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["text", "owner", "due"],
                    "properties": { "text": { "type": "string" }, "owner": nullable, "due": nullable }
                }
            }
        }
    })
}

#[derive(Deserialize)]
#[serde(untagged)]
enum AnyTodo {
    Plain(String),
    Detailed {
        text: String,
        #[serde(default)]
        owner: Option<String>,
        #[serde(default)]
        due: Option<String>,
    },
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct AnyNotes {
    title: Option<String>,
    summary: Option<String>,
    key_points: Vec<Option<String>>,
    todos: Vec<AnyTodo>,
}

/// A field the AI may fill with "", "null" or spaces: None then.
fn meaningful(s: Option<String>) -> Option<String> {
    s.map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && !s.eq_ignore_ascii_case("null"))
}

/// Reads the AI's answer: the JSON object in it, even inside a code block
/// or after a sentence. None when there is nothing usable.
pub fn read_notes(reply: &str) -> Option<Notes> {
    let from = reply.find('{')?;
    let to = reply.rfind('}')?;
    let raw: AnyNotes = serde_json::from_str(reply.get(from..=to)?).ok()?;
    let notes = Notes {
        title: meaningful(raw.title),
        summary: meaningful(raw.summary).unwrap_or_default(),
        key_points: raw
            .key_points
            .into_iter()
            .filter_map(meaningful)
            .take(6)
            .collect(),
        todos: raw
            .todos
            .into_iter()
            .filter_map(|t| {
                let (text, owner, due) = match t {
                    AnyTodo::Plain(text) => (text, None, None),
                    AnyTodo::Detailed { text, owner, due } => (text, owner, due),
                };
                Some(Todo {
                    id: unique_id(),
                    text: meaningful(Some(text))?,
                    owner: meaningful(owner),
                    due: meaningful(due),
                    done: false,
                })
            })
            .collect(),
    };
    let empty = notes.summary.is_empty() && notes.key_points.is_empty() && notes.todos.is_empty();
    (!empty).then_some(notes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn piece(speaker: &str, start: f64, end: f64, text: &str) -> Line {
        Line {
            id: unique_id(),
            speaker: speaker.into(),
            start,
            end,
            text: text.into(),
        }
    }

    fn person(n: usize) -> String {
        format!("Person {n}")
    }

    fn names() -> Names<'static> {
        Names {
            me: "Me",
            others: "Others",
            person: &person,
        }
    }

    #[test]
    fn pieces_join_until_a_pause_or_another_voice() {
        let lines = group_into_lines(vec![
            piece("me", 1.5, 2.5, "ça va"),
            piece("me", 0.0, 0.9, "bonjour à tous"),
            piece("me", 5.0, 6.0, "alors"),
            piece("v0", 6.2, 7.0, "salut"),
            piece("v0", 7.1, 7.5, "  "),
        ]);
        let texts: Vec<&str> = lines.iter().map(|l| l.text.as_str()).collect();
        assert_eq!(texts, ["bonjour à tous ça va", "alors", "salut"]);
        assert_eq!((lines[0].start, lines[0].end), (0.0, 2.5));
    }

    #[test]
    fn a_line_never_passes_forty_seconds() {
        let pieces = (0..5)
            .map(|i| piece("me", i as f64 * 10.0, i as f64 * 10.0 + 9.5, "mot"))
            .collect();
        let lines = group_into_lines(pieces);
        assert_eq!(lines.len(), 2);
        assert!(lines.iter().all(|l| l.end - l.start <= LONGEST_LINE));
    }

    #[test]
    fn the_speakers_heard_again_by_the_microphone_are_removed() {
        let mine = vec![
            piece("me", 1.0, 2.0, "on se voit demain"),
            piece("me", 10.0, 10.2, "oui"),
            piece("me", 20.0, 22.0, "je préfère vendredi"),
        ];
        let theirs = vec![
            piece("v0", 1.05, 2.05, "On se voit demain."),
            piece("v0", 20.5, 21.0, "vendredi"),
        ];
        let kept: Vec<String> = without_echo(&mine, &theirs)
            .into_iter()
            .map(|l| l.text)
            .collect();
        assert_eq!(kept, ["oui", "je préfère vendredi"]);
    }

    #[test]
    fn people_are_numbered_in_the_order_they_speak() {
        let (speakers, lines) = cast_call(
            vec![piece("me", 0.0, 0.5, "hello")],
            vec![piece("v1", 2.0, 2.4, "salut"), piece("v0", 6.0, 6.3, "hey")],
            &names(),
        );
        let named: Vec<&str> = speakers.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(named, ["Me", "Person 2", "Person 3"]);
        let who: Vec<&str> = lines.iter().map(|l| l.speaker.as_str()).collect();
        assert_eq!(who, ["me", "p2", "p3"]);

        let (speakers, _) = cast_call(Vec::new(), vec![piece(OTHERS, 1.0, 2.0, "allô")], &names());
        assert_eq!(speakers.len(), 1);
        assert_eq!(speakers[0].name, "Others");

        let (speakers, _) = cast_room(
            vec![piece("v0", 0.0, 1.0, "a"), piece("v1", 3.0, 4.0, "b")],
            &names(),
        );
        let named: Vec<&str> = speakers.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(named, ["Person 1", "Person 2"]);
    }

    #[test]
    fn the_notes_are_read_from_a_loose_answer() {
        let reply = "Here you go:\n```json\n{\"title\":\" Point produit \",\"summary\":\"On lance.\",\"key_points\":[\"a\",\"\",null],\"todos\":[{\"text\":\"Envoyer\",\"owner\":\"null\",\"due\":\"vendredi\"},\"Relire\",{\"text\":\" \"}]}\n```";
        let notes = read_notes(reply).unwrap();
        assert_eq!(notes.title.as_deref(), Some("Point produit"));
        assert_eq!(notes.key_points, ["a"]);
        assert_eq!(notes.todos.len(), 2);
        assert_eq!(notes.todos[0].owner, None);
        assert_eq!(notes.todos[0].due.as_deref(), Some("vendredi"));
        assert_eq!(notes.todos[1].text, "Relire");
        assert!(read_notes("no json here").is_none());
        assert!(read_notes("{\"summary\":\"\"}").is_none());
    }

    #[test]
    fn plain_text_uses_the_names() {
        let speakers = vec![Speaker {
            id: "me".into(),
            name: "Moi".into(),
            color: 0,
            is_me: true,
        }];
        let lines = vec![piece("me", 0.0, 1.0, "salut"), piece("p2", 1.0, 2.0, "yo")];
        assert_eq!(as_plain_text(&speakers, &lines), "Moi: salut\np2: yo");
    }
}
