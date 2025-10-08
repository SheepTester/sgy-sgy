use windows::Win32::Security::Cryptography::{CRYPT_INTEGER_BLOB, CryptUnprotectData};
use windows::core::PWSTR;

fn main() -> windows::core::Result<()> {
    let encrypted_data = vec![/* your encrypted bytes here */];

    let mut data_in = CRYPT_INTEGER_BLOB {
        cbData: encrypted_data.len() as u32,
        pbData: encrypted_data.as_ptr() as *mut u8,
    };

    let mut data_out = CRYPT_INTEGER_BLOB::default();

    unsafe {
        CryptUnprotectData(&mut data_in, None, None, None, None, 0, &mut data_out).ok()?;
    }

    let decrypted_bytes =
        unsafe { std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize) };
    println!("Decrypted: {:?}", decrypted_bytes);

    Ok(())
}
