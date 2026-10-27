//! Errors raised when hardware definitions are read.

use std::fmt;

/// A definition that does not conform to the schema.
#[derive(Debug)]
pub struct ParseError(toml::de::Error);

impl ParseError {
    pub(crate) fn from_toml(error: toml::de::Error) -> Self {
        Self(error)
    }
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl std::error::Error for ParseError {}
