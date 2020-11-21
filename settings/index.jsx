function Settings(props) {
  return (
    <Page>
      <Section title={<Text bold align="center">Characters</Text>}>
        <Select
          label={`Chinese calendar`}
          settingsKey="lunarChar"
          options={[
            {name:"Digits"},
            {name:"Chinese"},
          ]}
        />
      </Section>
    </Page>
  );
}

registerSettingsPage(Settings);
