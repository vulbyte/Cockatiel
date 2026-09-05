fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo:rerun-if-changed=../../proto/youtube_stream_list.proto");

    tonic_build::configure()
        .build_server(false)
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        .field_attribute(
            "youtube.api.v3.LiveChatGiftDetails.gift_duration",
            "#[serde(skip)]",
        )
        .compile(&["../../proto/youtube_stream_list.proto"], &["../../proto"])?;

    Ok(())
}
