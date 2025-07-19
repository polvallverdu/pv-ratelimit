# Contributing to pv-ratelimit

We love your input! We want to make contributing to pv-ratelimit as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📋 Guidelines

1. **Fork the repository**
2. **Create your feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Add tests for your changes**
5. **Ensure all tests pass** (`bun test`)
6. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
7. **Push to the branch** (`git push origin feature/amazing-feature`)
8. **Open a Pull Request**

## 🧪 Testing

### Running Tests

```bash
# Run all tests
bun test

# Run tests with coverage
bun test:coverage

# Run specific test suite
bun test dummy/
bun test ioredis/
```

### Testing with Redis

The Redis tests use Testcontainers to automatically spin up Redis instances. Make sure Docker is running before executing Redis tests.

### Adding Tests

- All new features should include comprehensive tests
- Tests should cover both happy path and error scenarios
- Follow the existing test patterns in the `test/` directory

## 🔧 Development Setup

```bash
# Clone the repository
git clone https://github.com/polvallverdu/pv-ratelimit.git
cd pv-ratelimit

# Install dependencies
bun install

# Build the project
bun run build

# Type checking
bun run typecheck

# Code formatting
bun run check:fix
```

## 📝 Code Style

- Follow the existing code style
- Use TypeScript with strict typing
- Add JSDoc comments for public APIs
- Run `bun run check:fix` before committing

## 🐛 Bug Reports

When filing an issue, make sure to answer these questions:

1. What version of pv-ratelimit are you using?
2. What operating system and processor architecture are you using?
3. What did you do?
4. What did you expect to see?
5. What did you see instead?

## 💡 Feature Requests

We track development and feature requests using GitHub issues. Feel free to open an issue to:

- Propose a new rate limiting algorithm
- Suggest a new backend implementation
- Request framework integrations
- Propose performance improvements

## 📄 License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

## 👥 Contributors

Thanks to these wonderful people who have contributed to this project:

<!-- ALL-CONTRIBUTORS-LIST:START -->

- [@polvallverdu](https://github.com/polvallverdu) - Creator and maintainer
<!-- ALL-CONTRIBUTORS-LIST:END -->

## 🙋‍♂️ Questions?

Feel free to reach out if you have any questions about contributing:

1. Check the [main documentation](README.md)
2. Search [existing issues](https://github.com/polvallverdu/pv-ratelimit/issues)
3. Create a [new issue](https://github.com/polvallverdu/pv-ratelimit/issues/new)
