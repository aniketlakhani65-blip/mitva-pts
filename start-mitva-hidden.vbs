' =============================================================================
' Mitva PTS — silent launcher
' Runs setup-and-run.bat hidden (no visible terminal window).
' Double-click this file, or create a Desktop shortcut to it.
' =============================================================================

Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Run the batch file hidden (0 = hidden window, False = don't wait for it to finish)
WshShell.CurrentDirectory = strPath
WshShell.Run "cmd /c """"" & strPath & "\setup-and-run.bat""""", 0, False
