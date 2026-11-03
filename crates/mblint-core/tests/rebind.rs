use std::collections::BTreeMap;

use mblint_core::rig::rebind;

fn bindings(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
    pairs
        .iter()
        .map(|(socket, device)| (socket.to_string(), device.to_string()))
        .collect()
}

const RIG: &str = r#"# The workstation under the desk
schema_version = "2.0.0"
name = "desk"
board = "boards/a.toml" # the first board

[bindings]
# graphics
PCIE1 = "devices/gpu.toml" # the big one
M2_1 = "devices/ssd.toml"
"#;

#[test]
fn keeps_every_line_whose_value_stays() {
    let same = bindings(&[("PCIE1", "devices/gpu.toml"), ("M2_1", "devices/ssd.toml")]);

    assert_eq!(rebind(RIG, "boards/a.toml", &same).unwrap(), RIG);
}

#[test]
fn changes_a_value_in_place_keeping_its_comments() {
    let changed = bindings(&[("PCIE1", "local/gpu2.toml"), ("M2_1", "devices/ssd.toml")]);

    assert_eq!(
        rebind(RIG, "local/b.toml", &changed).unwrap(),
        RIG.replace(r#""boards/a.toml""#, r#""local/b.toml""#)
            .replace(r#""devices/gpu.toml""#, r#""local/gpu2.toml""#),
    );
}

#[test]
fn removes_a_binding_with_the_comment_on_its_line_keeping_those_above_it() {
    let fewer = bindings(&[("M2_1", "devices/ssd.toml")]);

    assert_eq!(
        rebind(RIG, "boards/a.toml", &fewer).unwrap(),
        RIG.replace("PCIE1 = \"devices/gpu.toml\" # the big one\n", ""),
    );
}

#[test]
fn keeps_the_comments_above_the_last_binding_removed_at_the_end() {
    let rig = "schema_version = \"2.0.0\"\nname = \"x\"\nboard = \"b.toml\"\n\n[bindings]\nPCIE1 = \"g.toml\"\n# storage\nM2_1 = \"s.toml\"\n";

    let text = rebind(rig, "b.toml", &bindings(&[("PCIE1", "g.toml")])).unwrap();

    assert_eq!(text, rig.replace("M2_1 = \"s.toml\"\n", ""));
}

#[test]
fn adds_a_new_socket_after_the_last_binding() {
    let more = bindings(&[
        ("PCIE1", "devices/gpu.toml"),
        ("M2_1", "devices/ssd.toml"),
        ("M2_2", "local/ssd2.toml"),
    ]);

    assert_eq!(
        rebind(RIG, "boards/a.toml", &more).unwrap(),
        format!("{RIG}M2_2 = \"local/ssd2.toml\"\n"),
    );
}

#[test]
fn keeps_an_inline_table_inline() {
    let inline = "schema_version = \"2.0.0\"\nname = \"x\"\nboard = \"b.toml\"\nbindings = { PCIE1 = \"g.toml\" }\n";

    let text = rebind(inline, "b.toml", &bindings(&[("PCIE1", "h.toml")])).unwrap();

    assert_eq!(text, inline.replace("g.toml", "h.toml"));
}

#[test]
fn adds_to_an_inline_table_as_one_more_pair() {
    let inline = "schema_version = \"2.0.0\"\nname = \"x\"\nboard = \"b.toml\"\nbindings = { PCIE1 = \"g.toml\" }\n";

    let text = rebind(
        inline,
        "b.toml",
        &bindings(&[("PCIE1", "g.toml"), ("M2", "m.toml")]),
    )
    .unwrap();

    assert_eq!(
        text,
        inline.replace(r#""g.toml" }"#, r#""g.toml", M2 = "m.toml" }"#),
    );
}

#[test]
fn gives_a_rig_without_bindings_a_bindings_table_at_the_end() {
    let bare = "schema_version = \"2.0.0\"\nname = \"x\"\nboard = \"b.toml\"\n";

    let text = rebind(bare, "b.toml", &bindings(&[("PCIE1", "g.toml")])).unwrap();

    assert_eq!(text, format!("{bare}\n[bindings]\nPCIE1 = \"g.toml\"\n"));
}

#[test]
fn refuses_a_text_that_is_not_a_rig() {
    assert!(rebind("vendor = \"x\"\n", "b.toml", &BTreeMap::new()).is_err());
}
