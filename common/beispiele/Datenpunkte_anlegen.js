var Name_des_NAS;

// Beschreibe diese Funktion …
function Datenpunkte_erstellen() {
  createState("javascript.0.Synology_" + Name_des_NAS + ".CPUTemp1", {
    name: "CPU-Temp Core 1",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".CPUTemp2", {
    name: "CPU-Temp Core 2",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".CPUTemp3", {
    name: "CPU-Temp Core 3",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".CPUTemp4", {
    name: "CPU-Temp Core 4",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".CPUTempMax", {
    name: "CPU-Temp Max Core 1-4",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".CPUUsage", {
    name: "CPU-Usage",
    unit: "%",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".CPULoad", {
    name: "CPU-Load Average (1,5,15 Minuten)",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".MemTotalGB", {
    name: "Memory Total",
    unit: "GB",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".MemFreeGB", {
    name: "Memory Free",
    unit: "GB",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".MemUsedGB", {
    name: "Memory Used",
    unit: "GB",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".MemFreePercent", {
    name: "Memory Free",
    unit: "%",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".MemUsedPercent", {
    name: "Memory Used",
    unit: "%",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".HDDTemp1", {
    name: "HDD-Temp 1",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".HDDTemp2", {
    name: "HDD-Temp 2",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".HDDTemp3", {
    name: "HDD-Temp 3",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".HDDTemp4", {
    name: "HDD-Temp 4",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".HDDTemp5", {
    name: "HDD-Temp 5",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".HDDTemp6", {
    name: "HDD-Temp 6",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".HDDTemp7", {
    name: "HDD-Temp 7",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".HDDTemp8", {
    name: "HDD-Temp 8",
    unit: "°C",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Storage1TotalGB", {
    name: "Storage1 Total",
    unit: "GB",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Storage1FreeGB", {
    name: "Storage1 Free",
    unit: "GB",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Storage1UsedGB", {
    name: "Storage1 Used",
    unit: "GB",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Storage1FreePercent", {
    name: "Storage1 Free",
    unit: "%",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Storage1UsedPercent", {
    name: "Storage1 Used",
    unit: "%",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Storage2TotalGB", {
    name: "Storage2 Total",
    unit: "GB",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Storage2FreeGB", {
    name: "Storage2 Free",
    unit: "GB",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Storage2UsedGB", {
    name: "Storage2 Used",
    unit: "GB",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Storage2FreePercent", {
    name: "Storage2 Free",
    unit: "%",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Storage2UsedPercent", {
    name: "Storage2 Used",
    unit: "%",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".UptimeDays", {
    name: "Uptime Days",
    unit: "Tage",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".UptimeHours", {
    name: "Uptime Hours",
    unit: "Stunden",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".UptimeMinutes", {
    name: "Storage Minutes",
    unit: "Minuten",
  });
  createState("javascript.0.Synology_" + Name_des_NAS + ".DSMVersion", { name: "DSM Version" });
  createState("javascript.0.Synology_" + Name_des_NAS + ".Timestamp", {
    name: "Timestamp Data Update",
  });
}

Name_des_NAS = "DS218+";
Datenpunkte_erstellen();

//JTNDeG1sJTIweG1sbnMlM0QlMjJodHRwcyUzQSUyRiUyRmRldmVsb3BlcnMuZ29vZ2xlLmNvbSUyRmJsb2NrbHklMkZ4bWwlMjIlM0UlM0N2YXJpYWJsZXMlM0UlM0N2YXJpYWJsZSUyMGlkJTNEJTIya0RBZk9XJTJDKCUzRDY1RlElNjAlMjVuWTRwcSUyMiUzRU5hbWVfZGVzX05BUyUzQyUyRnZhcmlhYmxlJTNFJTNDJTJGdmFyaWFibGVzJTNFJTNDYmxvY2slMjB0eXBlJTNEJTIydmFyaWFibGVzX3NldCUyMiUyMGlkJTNEJTIyVTdWRSU1RFNIMzQlNURWN2Z2VCUyRiU1RTV5diUyMiUyMHglM0QlMjItODclMjIlMjB5JTNEJTIyLTExMiUyMiUzRSUzQ2ZpZWxkJTIwbmFtZSUzRCUyMlZBUiUyMiUyMGlkJTNEJTIya0RBZk9XJTJDKCUzRDY1RlElNjAlMjVuWTRwcSUyMiUzRU5hbWVfZGVzX05BUyUzQyUyRmZpZWxkJTNFJTNDdmFsdWUlMjBuYW1lJTNEJTIyVkFMVUUlMjIlM0UlM0NibG9jayUyMHR5cGUlM0QlMjJ0ZXh0JTIyJTIwaWQlM0QlMjIqQSUzQlglM0Qpa3VsQ2whMTRRUSU2MCUyQ1V+JTIyJTNFJTNDZmllbGQlMjBuYW1lJTNEJTIyVEVYVCUyMiUzRURTMjE4JTJCJTNDJTJGZmllbGQlM0UlM0MlMkZibG9jayUzRSUzQyUyRnZhbHVlJTNFJTNDbmV4dCUzRSUzQ2Jsb2NrJTIwdHlwZSUzRCUyMnByb2NlZHVyZXNfY2FsbGN1c3RvbW5vcmV0dXJuJTIyJTIwaWQlM0QlMjJqJTNGJTVCJTJCQllLUDc1LU4pLk1VNHBvYiUyMiUzRSUzQ211dGF0aW9uJTIwbmFtZSUzRCUyMkRhdGVucHVua3RlJTIwZXJzdGVsbGVuJTIyJTNFJTNDJTJGbXV0YXRpb24lM0UlM0MlMkZibG9jayUzRSUzQyUyRm5leHQlM0UlM0MlMkZibG9jayUzRSUzQ2Jsb2NrJTIwdHlwZSUzRCUyMnByb2NlZHVyZXNfZGVmY3VzdG9tbm9yZXR1cm4lMjIlMjBpZCUzRCUyMk9HKSU3QyU3QzFSbiklMkNpaChyX1BmTWJPJTIyJTIweCUzRCUyMjEzOCUyMiUyMHklM0QlMjItMzclMjIlM0UlM0NtdXRhdGlvbiUyMHN0YXRlbWVudHMlM0QlMjJmYWxzZSUyMiUzRSUzQyUyRm11dGF0aW9uJTNFJTNDZmllbGQlMjBuYW1lJTNEJTIyTkFNRSUyMiUzRURhdGVucHVua3RlJTIwZXJzdGVsbGVuJTNDJTJGZmllbGQlM0UlM0NmaWVsZCUyMG5hbWUlM0QlMjJTQ1JJUFQlMjIlM0VZM0psWVhSbFUzUmhkR1VvSW1waGRtRnpZM0pwY0hRdU1DNVRlVzV2Ykc5bmVWOGlLeUJPWVcxbFgyUmxjMTlPUVZNZ0t5SXVRMUJWVkdWdGNERWlMQ0I3Ym1GdFpUb2dJa05RVlMxVVpXMXdJRU52Y21VZ01TSXNJSFZ1YVhRNklDTENzRU1pZlNrN0RRcGpjbVZoZEdWVGRHRjBaU2dpYW1GMllYTmpjbWx3ZEM0d0xsTjVibTlzYjJkNVh5SXJJRTVoYldWZlpHVnpYMDVCVXlBcklpNURVRlZVWlcxd01pSXNJSHR1WVcxbE9pQWlRMUJWTFZSbGJYQWdRMjl5WlNBeUlpd2dkVzVwZERvZ0lzS3dReUo5S1RzTkNtTnlaV0YwWlZOMFlYUmxLQ0pxWVhaaGMyTnlhWEIwTGpBdVUzbHViMnh2WjNsZklpc2dUbUZ0WlY5a1pYTmZUa0ZUSUNzaUxrTlFWVlJsYlhBeklpd2dlMjVoYldVNklDSkRVRlV0VkdWdGNDQkRiM0psSURNaUxDQjFibWwwT2lBaXdyQkRJbjBwT3cwS1kzSmxZWFJsVTNSaGRHVW9JbXBoZG1GelkzSnBjSFF1TUM1VGVXNXZiRzluZVY4aUt5Qk9ZVzFsWDJSbGMxOU9RVk1nS3lJdVExQlZWR1Z0Y0RRaUxDQjdibUZ0WlRvZ0lrTlFWUzFVWlcxd0lFTnZjbVVnTkNJc0lIVnVhWFE2SUNMQ3NFTWlmU2s3RFFwamNtVmhkR1ZUZEdGMFpTZ2lhbUYyWVhOamNtbHdkQzR3TGxONWJtOXNiMmQ1WHlJcklFNWhiV1ZmWkdWelgwNUJVeUFySWk1RFVGVlVaVzF3VFdGNElpd2dlMjVoYldVNklDSkRVRlV0VkdWdGNDQk5ZWGdnUTI5eVpTQXhMVFFpTENCMWJtbDBPaUFpd3JCREluMHBPdzBLWTNKbFlYUmxVM1JoZEdVb0ltcGhkbUZ6WTNKcGNIUXVNQzVUZVc1dmJHOW5lVjhpS3lCT1lXMWxYMlJsYzE5T1FWTWdLeUl1UTFCVlZYTmhaMlVpTENCN2JtRnRaVG9nSWtOUVZTMVZjMkZuWlNJc0lIVnVhWFE2SUNJbEluMHBPdzBLWTNKbFlYUmxVM1JoZEdVb0ltcGhkbUZ6WTNKcGNIUXVNQzVUZVc1dmJHOW5lVjhpS3lCT1lXMWxYMlJsYzE5T1FWTWdLeUl1UTFCVlRHOWhaQ0lzSUh0dVlXMWxPaUFpUTFCVkxVeHZZV1FnUVhabGNtRm5aU0FvTVN3MUxERTFJRTFwYm5WMFpXNHBJbjBwT3cwS1kzSmxZWFJsVTNSaGRHVW9JbXBoZG1GelkzSnBjSFF1TUM1VGVXNXZiRzluZVY4aUt5Qk9ZVzFsWDJSbGMxOU9RVk1nS3lJdVRXVnRWRzkwWVd4SFFpSXNJSHR1WVcxbE9pQWlUV1Z0YjNKNUlGUnZkR0ZzSWl3Z2RXNXBkRG9nSWtkQ0luMHBPdzBLWTNKbFlYUmxVM1JoZEdVb0ltcGhkbUZ6WTNKcGNIUXVNQzVUZVc1dmJHOW5lVjhpS3lCT1lXMWxYMlJsYzE5T1FWTWdLeUl1VFdWdFJuSmxaVWRDSWl3Z2UyNWhiV1U2SUNKTlpXMXZjbmtnUm5KbFpTSXNJSFZ1YVhRNklDSkhRaUo5S1RzTkNtTnlaV0YwWlZOMFlYUmxLQ0pxWVhaaGMyTnlhWEIwTGpBdVUzbHViMnh2WjNsZklpc2dUbUZ0WlY5a1pYTmZUa0ZUSUNzaUxrMWxiVlZ6WldSSFFpSXNJSHR1WVcxbE9pQWlUV1Z0YjNKNUlGVnpaV1FpTENCMWJtbDBPaUFpUjBJaWZTazdEUXBqY21WaGRHVlRkR0YwWlNnaWFtRjJZWE5qY21sd2RDNHdMbE41Ym05c2IyZDVYeUlySUU1aGJXVmZaR1Z6WDA1QlV5QXJJaTVOWlcxR2NtVmxVR1Z5WTJWdWRDSXNJSHR1WVcxbE9pQWlUV1Z0YjNKNUlFWnlaV1VpTENCMWJtbDBPaUFpSlNKOUtUc05DbU55WldGMFpWTjBZWFJsS0NKcVlYWmhjMk55YVhCMExqQXVVM2x1YjJ4dlozbGZJaXNnVG1GdFpWOWtaWE5mVGtGVElDc2lMazFsYlZWelpXUlFaWEpqWlc1MElpd2dlMjVoYldVNklDSk5aVzF2Y25rZ1ZYTmxaQ0lzSUhWdWFYUTZJQ0lsSW4wcE93MEtZM0psWVhSbFUzUmhkR1VvSW1waGRtRnpZM0pwY0hRdU1DNVRlVzV2Ykc5bmVWOGlLeUJPWVcxbFgyUmxjMTlPUVZNZ0t5SXVTRVJFVkdWdGNERWlMQ0I3Ym1GdFpUb2dJa2hFUkMxVVpXMXdJREVpTENCMWJtbDBPaUFpd3JCREluMHBPdzBLWTNKbFlYUmxVM1JoZEdVb0ltcGhkbUZ6WTNKcGNIUXVNQzVUZVc1dmJHOW5lVjhpS3lCT1lXMWxYMlJsYzE5T1FWTWdLeUl1U0VSRVZHVnRjRElpTENCN2JtRnRaVG9nSWtoRVJDMVVaVzF3SURJaUxDQjFibWwwT2lBaXdyQkRJbjBwT3cwS1kzSmxZWFJsVTNSaGRHVW9JbXBoZG1GelkzSnBjSFF1TUM1VGVXNXZiRzluZVY4aUt5Qk9ZVzFsWDJSbGMxOU9RVk1nS3lJdVNFUkVWR1Z0Y0RNaUxDQjdibUZ0WlRvZ0lraEVSQzFVWlcxd0lETWlMQ0IxYm1sME9pQWl3ckJESW4wcE93MEtZM0psWVhSbFUzUmhkR1VvSW1waGRtRnpZM0pwY0hRdU1DNVRlVzV2Ykc5bmVWOGlLeUJPWVcxbFgyUmxjMTlPUVZNZ0t5SXVTRVJFVkdWdGNEUWlMQ0I3Ym1GdFpUb2dJa2hFUkMxVVpXMXdJRFFpTENCMWJtbDBPaUFpd3JCREluMHBPdzBLWTNKbFlYUmxVM1JoZEdVb0ltcGhkbUZ6WTNKcGNIUXVNQzVUZVc1dmJHOW5lVjhpS3lCT1lXMWxYMlJsYzE5T1FWTWdLeUl1U0VSRVZHVnRjRFVpTENCN2JtRnRaVG9nSWtoRVJDMVVaVzF3SURVaUxDQjFibWwwT2lBaXdyQkRJbjBwT3cwS1kzSmxZWFJsVTNSaGRHVW9JbXBoZG1GelkzSnBjSFF1TUM1VGVXNXZiRzluZVY4aUt5Qk9ZVzFsWDJSbGMxOU9RVk1nS3lJdVNFUkVWR1Z0Y0RZaUxDQjdibUZ0WlRvZ0lraEVSQzFVWlcxd0lEWWlMQ0IxYm1sME9pQWl3ckJESW4wcE93MEtZM0psWVhSbFUzUmhkR1VvSW1waGRtRnpZM0pwY0hRdU1DNVRlVzV2Ykc5bmVWOGlLeUJPWVcxbFgyUmxjMTlPUVZNZ0t5SXVTRVJFVkdWdGNEY2lMQ0I3Ym1GdFpUb2dJa2hFUkMxVVpXMXdJRGNpTENCMWJtbDBPaUFpd3JCREluMHBPdzBLWTNKbFlYUmxVM1JoZEdVb0ltcGhkbUZ6WTNKcGNIUXVNQzVUZVc1dmJHOW5lVjhpS3lCT1lXMWxYMlJsYzE5T1FWTWdLeUl1U0VSRVZHVnRjRGdpTENCN2JtRnRaVG9nSWtoRVJDMVVaVzF3SURnaUxDQjFibWwwT2lBaXdyQkRJbjBwT3cwS1kzSmxZWFJsVTNSaGRHVW9JbXBoZG1GelkzSnBjSFF1TUM1VGVXNXZiRzluZVY4aUt5Qk9ZVzFsWDJSbGMxOU9RVk1nS3lJdVUzUnZjbUZuWlRGVWIzUmhiRWRDSWl3Z2UyNWhiV1U2SUNKVGRHOXlZV2RsTVNCVWIzUmhiQ0lzSUhWdWFYUTZJQ0pIUWlKOUtUc05DbU55WldGMFpWTjBZWFJsS0NKcVlYWmhjMk55YVhCMExqQXVVM2x1YjJ4dlozbGZJaXNnVG1GdFpWOWtaWE5mVGtGVElDc2lMbE4wYjNKaFoyVXhSbkpsWlVkQ0lpd2dlMjVoYldVNklDSlRkRzl5WVdkbE1TQkdjbVZsSWl3Z2RXNXBkRG9nSWtkQ0luMHBPdzBLWTNKbFlYUmxVM1JoZEdVb0ltcGhkbUZ6WTNKcGNIUXVNQzVUZVc1dmJHOW5lVjhpS3lCT1lXMWxYMlJsYzE5T1FWTWdLeUl1VTNSdmNtRm5aVEZWYzJWa1IwSWlMQ0I3Ym1GdFpUb2dJbE4wYjNKaFoyVXhJRlZ6WldRaUxDQjFibWwwT2lBaVIwSWlmU2s3RFFwamNtVmhkR1ZUZEdGMFpTZ2lhbUYyWVhOamNtbHdkQzR3TGxONWJtOXNiMmQ1WHlJcklFNWhiV1ZmWkdWelgwNUJVeUFySWk1VGRHOXlZV2RsTVVaeVpXVlFaWEpqWlc1MElpd2dlMjVoYldVNklDSlRkRzl5WVdkbE1TQkdjbVZsSWl3Z2RXNXBkRG9nSWlVaWZTazdEUXBqY21WaGRHVlRkR0YwWlNnaWFtRjJZWE5qY21sd2RDNHdMbE41Ym05c2IyZDVYeUlySUU1aGJXVmZaR1Z6WDA1QlV5QXJJaTVUZEc5eVlXZGxNVlZ6WldSUVpYSmpaVzUwSWl3Z2UyNWhiV1U2SUNKVGRHOXlZV2RsTVNCVmMyVmtJaXdnZFc1cGREb2dJaVVpZlNrN0RRcGpjbVZoZEdWVGRHRjBaU2dpYW1GMllYTmpjbWx3ZEM0d0xsTjVibTlzYjJkNVh5SXJJRTVoYldWZlpHVnpYMDVCVXlBcklpNVRkRzl5WVdkbE1sUnZkR0ZzUjBJaUxDQjdibUZ0WlRvZ0lsTjBiM0poWjJVeUlGUnZkR0ZzSWl3Z2RXNXBkRG9nSWtkQ0luMHBPdzBLWTNKbFlYUmxVM1JoZEdVb0ltcGhkbUZ6WTNKcGNIUXVNQzVUZVc1dmJHOW5lVjhpS3lCT1lXMWxYMlJsYzE5T1FWTWdLeUl1VTNSdmNtRm5aVEpHY21WbFIwSWlMQ0I3Ym1GdFpUb2dJbE4wYjNKaFoyVXlJRVp5WldVaUxDQjFibWwwT2lBaVIwSWlmU2s3RFFwamNtVmhkR1ZUZEdGMFpTZ2lhbUYyWVhOamNtbHdkQzR3TGxONWJtOXNiMmQ1WHlJcklFNWhiV1ZmWkdWelgwNUJVeUFySWk1VGRHOXlZV2RsTWxWelpXUkhRaUlzSUh0dVlXMWxPaUFpVTNSdmNtRm5aVElnVlhObFpDSXNJSFZ1YVhRNklDSkhRaUo5S1RzTkNtTnlaV0YwWlZOMFlYUmxLQ0pxWVhaaGMyTnlhWEIwTGpBdVUzbHViMnh2WjNsZklpc2dUbUZ0WlY5a1pYTmZUa0ZUSUNzaUxsTjBiM0poWjJVeVJuSmxaVkJsY21ObGJuUWlMQ0I3Ym1GdFpUb2dJbE4wYjNKaFoyVXlJRVp5WldVaUxDQjFibWwwT2lBaUpTSjlLVHNOQ21OeVpXRjBaVk4wWVhSbEtDSnFZWFpoYzJOeWFYQjBMakF1VTNsdWIyeHZaM2xmSWlzZ1RtRnRaVjlrWlhOZlRrRlRJQ3NpTGxOMGIzSmhaMlV5VlhObFpGQmxjbU5sYm5RaUxDQjdibUZ0WlRvZ0lsTjBiM0poWjJVeUlGVnpaV1FpTENCMWJtbDBPaUFpSlNKOUtUc05DbU55WldGMFpWTjBZWFJsS0NKcVlYWmhjMk55YVhCMExqQXVVM2x1YjJ4dlozbGZJaXNnVG1GdFpWOWtaWE5mVGtGVElDc2lMbFZ3ZEdsdFpVUmhlWE1pTENCN2JtRnRaVG9nSWxWd2RHbHRaU0JFWVhseklpd2dkVzVwZERvZ0lsUmhaMlVpZlNrN0RRcGpjbVZoZEdWVGRHRjBaU2dpYW1GMllYTmpjbWx3ZEM0d0xsTjVibTlzYjJkNVh5SXJJRTVoYldWZlpHVnpYMDVCVXlBcklpNVZjSFJwYldWSWIzVnljeUlzSUh0dVlXMWxPaUFpVlhCMGFXMWxJRWh2ZFhKeklpd2dkVzVwZERvZ0lsTjBkVzVrWlc0aWZTazdEUXBqY21WaGRHVlRkR0YwWlNnaWFtRjJZWE5qY21sd2RDNHdMbE41Ym05c2IyZDVYeUlySUU1aGJXVmZaR1Z6WDA1QlV5QXJJaTVWY0hScGJXVk5hVzUxZEdWeklpd2dlMjVoYldVNklDSlRkRzl5WVdkbElFMXBiblYwWlhNaUxDQjFibWwwT2lBaVRXbHVkWFJsYmlKOUtUc05DbU55WldGMFpWTjBZWFJsS0NKcVlYWmhjMk55YVhCMExqQXVVM2x1YjJ4dlozbGZJaXNnVG1GdFpWOWtaWE5mVGtGVElDc2lMa1JUVFZabGNuTnBiMjRpTENCN2JtRnRaVG9nSWtSVFRTQldaWEp6YVc5dUluMHBPdzBLWTNKbFlYUmxVM1JoZEdVb0ltcGhkbUZ6WTNKcGNIUXVNQzVUZVc1dmJHOW5lVjhpS3lCT1lXMWxYMlJsYzE5T1FWTWdLeUl1VkdsdFpYTjBZVzF3SWl3Z2UyNWhiV1U2SUNKVWFXMWxjM1JoYlhBZ1JHRjBZU0JWY0dSaGRHVWlmU2s3JTNDJTJGZmllbGQlM0UlM0Njb21tZW50JTIwcGlubmVkJTNEJTIyZmFsc2UlMjIlMjBoJTNEJTIyODAlMjIlMjB3JTNEJTIyMTYwJTIyJTNFQmVzY2hyZWliZSUyMGRpZXNlJTIwRnVua3Rpb24lMjAlRTIlODAlQTYlM0MlMkZjb21tZW50JTNFJTNDJTJGYmxvY2slM0UlM0MlMkZ4bWwlM0U=
