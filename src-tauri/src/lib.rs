// Coquille de bureau de SPECTRA : une fenêtre qui affiche l'application web
// embarquée. Aucune commande native, aucun accès réseau.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("erreur au lancement de SPECTRA");
}
