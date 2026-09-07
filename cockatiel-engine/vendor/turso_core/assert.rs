/// turso_assert! is a direct replacement for assert! builtin macros which under the hood
/// uses Antithesis SDK to guide Antithesis simulator if --features antithesis is enabled
#[cfg(not(feature = "antithesis"))]
#[macro_export]
macro_rules! turso_assert {
    ($cond:expr, $msg:literal, $($optional:tt)+) => {
        assert!($cond, $msg, $($optional)+);
    };
    ($cond:expr, $msg:literal) => {
        assert!($cond, $msg);
    };
}

#[cfg(feature = "antithesis")]
#[macro_export]
macro_rules! turso_assert {
    ($cond:expr, $msg:literal, $($optional:tt)+) => {
        antithesis_sdk::assert_always_or_unreachable!($cond, $msg);
        assert!($cond, $msg, $($optional)+);
    };
    ($cond:expr, $msg:literal) => {
        antithesis_sdk::assert_always_or_unreachable!($cond, $msg);
        assert!($cond, $msg);
    };
}
