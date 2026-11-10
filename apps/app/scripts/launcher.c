// Electrobun's native launcher starts its Bun worker with a fixed argument list.
// Pass the Studio mode across that process boundary before delegating to it.
#ifdef _WIN32
#include <windows.h>
#include <wchar.h>
#include <process.h>
int wmain(int argc, wchar_t **argv) {
  for (int i = 1; i < argc; i++) {
    if (wcscmp(argv[i], L"--mock") == 0) SetEnvironmentVariableW(L"INTLOOM_STUDIO_MODE", L"mock");
  }
  wchar_t path[32768];
  DWORD len = GetModuleFileNameW(NULL, path, 32768);
  if (!len || len >= 32768) return 1;
  wchar_t *file = wcsrchr(path, L'\\');
  if (!file || wcscpy_s(file + 1, 32768 - (file + 1 - path), L"electrobun-launcher.exe")) return 1;
  STARTUPINFOW startup = { .cb = sizeof(STARTUPINFOW) };
  PROCESS_INFORMATION child;
  if (!CreateProcessW(path, GetCommandLineW(), NULL, NULL, TRUE, 0, NULL, NULL, &startup, &child)) return 1;
  WaitForSingleObject(child.hProcess, INFINITE);
  DWORD code = 1;
  GetExitCodeProcess(child.hProcess, &code);
  CloseHandle(child.hProcess);
  CloseHandle(child.hThread);
  return (int)code;
}
#else
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#ifdef __APPLE__
#include <mach-o/dyld.h>
#endif
int main(int argc, char **argv) {
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--mock") == 0) setenv("INTLOOM_STUDIO_MODE", "mock", 1);
  }
  char path[PATH_MAX];
#ifdef __APPLE__
  uint32_t size = sizeof(path);
  if (_NSGetExecutablePath(path, &size)) return 1;
#else
  ssize_t len = readlink("/proc/self/exe", path, sizeof(path)-1);
  if (len < 0 || len >= sizeof(path)-1) return 1;
  path[len] = '\0';
#endif
  char *file = strrchr(path, '/');
  if (!file || (size_t)(file + 1 - path) + sizeof("electrobun-launcher") > sizeof(path)) return 1;
  strcpy(file + 1, "electrobun-launcher");
  execv(path, argv);
  perror("Studio launcher");
  return 1;
}
#endif
