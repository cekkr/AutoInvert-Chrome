$currentfolder = Get-Location

# Remove Thumbs.db
Get-ChildItem -Path $currentfolder -File -Include Thumbs.db -Recurse | Remove-Item -Force -Verbose

Remove-Item -Force -Verbose desktop.ini -ErrorAction Ignore