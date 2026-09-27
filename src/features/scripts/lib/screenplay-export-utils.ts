import type { ScriptSceneItem } from '../actions'

/**
 * Exports screenplay scenes to universal .fountain format
 */
export function exportToFountain(title: string, scenes: ScriptSceneItem[]) {
  const lines: string[] = []

  // Title Page Header
  lines.push(`Title: ${title.toUpperCase()}`)
  lines.push(`Credit: Written by`)
  lines.push(`Draft date: ${new Date().toLocaleDateString()}`)
  lines.push(`\n===\n`)

  for (const scene of scenes) {
    const heading = scene.heading || `${scene.int_ext || 'INT'}. ${scene.location_name || 'LOCATION'} - ${scene.time_of_day || 'DAY'}`
    lines.push(`\n.${heading.toUpperCase()} #${scene.scene_number}#\n`)

    if (scene.description && scene.description.trim().length > 0) {
      // Remove duplicated heading if already at start of description
      let desc = scene.description.trim()
      if (desc.startsWith(heading)) {
        desc = desc.substring(heading.length).trim()
      }
      lines.push(desc)
    }
  }

  const fountainContent = lines.join('\n')
  const blob = new Blob([fountainContent], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.fountain`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Exports screenplay scenes to industry-standard Final Draft XML (.fdx) format
 */
export function exportToFDX(title: string, writer: string, scenes: ScriptSceneItem[]) {
  const paragraphs: string[] = []

  for (const scene of scenes) {
    const heading = scene.heading || `${scene.int_ext || 'INT'}. ${scene.location_name || 'LOCATION'} - ${scene.time_of_day || 'DAY'}`
    
    // Scene Heading Paragraph
    paragraphs.push(`
    <Paragraph Type="Scene Heading" Number="${escapeXml(scene.scene_number)}">
      <SceneProperties Length="1" Page="1">
        <SceneSchedule Title="${escapeXml(heading)}" Number="${escapeXml(scene.scene_number)}" />
      </SceneProperties>
      <Text>${escapeXml(heading.toUpperCase())}</Text>
    </Paragraph>`)

    if (scene.description && scene.description.trim().length > 0) {
      let desc = scene.description.trim()
      if (desc.startsWith(heading)) {
        desc = desc.substring(heading.length).trim()
      }

      const rawLines = desc.split(/\r?\n/)
      for (const rawLine of rawLines) {
        const line = rawLine.trim()
        if (!line) continue

        // Character Cue (ALL CAPS short line)
        if (line === line.toUpperCase() && line.length < 35 && !/[.?!]$/.test(line)) {
          paragraphs.push(`
    <Paragraph Type="Character">
      <Text>${escapeXml(line)}</Text>
    </Paragraph>`)
        } else if (line.startsWith('(') && line.endsWith(')')) {
          paragraphs.push(`
    <Paragraph Type="Parenthetical">
      <Text>${escapeXml(line)}</Text>
    </Paragraph>`)
        } else if (/^(?:CUT TO:|FADE IN:|FADE OUT:|DISSOLVE TO:)/i.test(line)) {
          paragraphs.push(`
    <Paragraph Type="Transition">
      <Text>${escapeXml(line.toUpperCase())}</Text>
    </Paragraph>`)
        } else {
          paragraphs.push(`
    <Paragraph Type="Action">
      <Text>${escapeXml(line)}</Text>
    </Paragraph>`)
        }
      }
    }
  }

  const fdxXml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="4">
  <Content>
    ${paragraphs.join('\n')}
  </Content>
  <HeaderAndFooter>
    <Header>
      <Paragraph Alignment="Right">
        <Text>${escapeXml(title)}</Text>
      </Paragraph>
    </Header>
  </HeaderAndFooter>
  <TitlePage>
    <Content>
      <Paragraph Alignment="Center">
        <Text AdornmentStyle="-1" Background="#FFFFFFFFFFFF" Color="#000000000000" Font="Courier Final Draft" RevisionID="0" Size="12" Style="Bold">${escapeXml(title.toUpperCase())}</Text>
      </Paragraph>
      <Paragraph Alignment="Center">
        <Text>by</Text>
      </Paragraph>
      <Paragraph Alignment="Center">
        <Text>${escapeXml(writer || 'Screenwriter')}</Text>
      </Paragraph>
    </Content>
  </TitlePage>
</FinalDraft>`

  const blob = new Blob([fdxXml], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.fdx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
