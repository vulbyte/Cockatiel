//this function builds to protobuf handler
fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo:rerun-if-changed=../proto/cockatiel_protobuf.proto");
    prost_build::compile_protos(&["../proto/cockatiel_protobuf.proto"], &["../proto"])?;
    return Ok(());
}
