$currentFolder = Get-Location
$extensionFolder = (get-item $currentFolder).parent.FullName + '\chrome-extension'

# Remove Thumbs.db and desktop.ini files
Get-ChildItem -Path $extensionFolder -File -Include Thumbs.db -Recurse | Remove-Item -Force -Verbose
Get-ChildItem -Path $extensionFolder -File -Include desktop.ini -Recurse | Remove-Item -Force -Verbose