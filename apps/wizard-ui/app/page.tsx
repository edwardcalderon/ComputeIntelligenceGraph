export default function WizardPage() {
  return (
    <main>
      <h1>CIG Installation Wizard</h1>
      <p>Step-by-step setup — coming soon.</p>
      <footer style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#888" }}>
        CIG Wizard · v{process.env.NEXT_PUBLIC_APP_VERSION}
      </footer>
    </main>
  );
}
