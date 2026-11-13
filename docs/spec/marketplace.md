# Marketplace

[日本語](marketplace.jp.md)

The marketplace is a page that lists rigs published on GitHub, each opening in the web simulator. It is a separate site from the simulator, at marketplace.mblint.shortarrow.jp.

## Listing

A public repository on GitHub is listed when it carries the topic `mblint-rig`. Adding the topic is all a publisher does; nothing is submitted and nothing is reviewed. A repository loses its place when it drops the topic, becomes private or is deleted, and when it is named in the marketplace's list of excluded repositories.

Each repository is shown with its `<owner>/<repo>`, its description, its number of stars and the date it was last pushed to. The repository's name links to it on GitHub, and a control opens it in the simulator at `https://mblint.shortarrow.jp/?github=<owner>/<repo>`, which loads the root of its default branch as the simulator's address does.

The repositories are ordered by their number of stars, most first. A field narrows them to those whose `<owner>/<repo>` or description contains its text, ignoring case.

What the marketplace shows is at most an hour behind GitHub. The marketplace does not read the repositories' files, so a listed repository may hold no rig the simulator can load; the simulator says so when it is opened.

## Build

The marketplace is a Cloudflare Worker. It asks GitHub's search API for the repositories with the topic, signed in with a token that only reads public data, and keeps the answer for an hour, so a visitor's browser never asks GitHub. When GitHub cannot be reached, it serves the last answer it kept, and says how old that is. When it cannot read the answer it keeps, it says that it is busy and to try again later, and does not ask GitHub.
