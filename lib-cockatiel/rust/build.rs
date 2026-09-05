fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let proto_dir = manifest_dir.join("../../proto").canonicalize()?;
    
    let mut proto_files = Vec::new();
    for entry in std::fs::read_dir(&proto_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("proto") {
            proto_files.push(path);
        }
    }

    if proto_files.is_empty() {
        return Err("No .proto files found in the proto directory!".into());
    }

    for proto in &proto_files {
        println!("cargo:rerun-if-changed={}", proto.display());
    }

    tonic_build::configure()
        .compile(&proto_files, &[&proto_dir])?;

    Ok(())
}
