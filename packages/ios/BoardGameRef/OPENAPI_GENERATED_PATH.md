# OpenAPI Generated Sources (Xcode Build Plugin)

The Swift OpenAPI generator runs during Xcode builds and writes its output to
DerivedData (not in the repo). The generated `Client.swift` and `Types.swift`
are located under the build plugin intermediates.

Example path on this machine:

```sh
~/Library/Developer/Xcode/DerivedData/BoardGameRef-<hash>/Build/Intermediates.noindex/BuildToolPluginIntermediates/BoardGameRef.output/BoardGameRef/OpenAPIGenerator/GeneratedSources
```

Notes:

- The `<hash>` portion changes per machine/project state.
- If you can open `Client.swift` in Xcode, use the file’s path (Jump Bar) to find the exact DerivedData location.
- The directory contains all generated sources (client + types).
