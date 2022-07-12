declare global {
  interface Array<T> {
    map<Arr extends unknown[], Mapped>(
      this: Arr,
      map: (element: Arr[number], index: number, array: Arr[number]) => Mapped
    ): { [Key in keyof Arr]: Mapped } & Mapped[]; // & Mapped[] makes inferring Mapped based on where the result of .map is passed work
  }
}

export {};
