using System;

class HelloWorld
{
    static int Add(int a, int b)
    {
        int result = a + b;
        return result;
    }

    static void Main(string[] args)
    {
        Console.WriteLine("Starting...");
        int x = 10;
        int y = 20;
        int sum = Add(x, y);
        string msg = $"Sum: {sum}";
        Console.WriteLine(msg);
    }
}
