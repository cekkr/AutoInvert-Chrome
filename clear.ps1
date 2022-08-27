$currentfolder = Get-Location

# Remove Thumbs.db and desktop.ini
Get-ChildItem -Path $currentfolder -File -Include Thumbs.db -Recurse | Remove-Item -Force -Verbose
Get-ChildItem -Path $currentfolder -File -Include desktop.ini -Recurse | Remove-Item -Force -Verbose