"""Reverse a string, from the command line or interactively."""

import sys


def reverse_string(s: str) -> str:
    return s[::-1]


def main() -> None:
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
    else:
        text = input("Enter a string to reverse: ")

    print(reverse_string(text))


if __name__ == "__main__":
    main()
