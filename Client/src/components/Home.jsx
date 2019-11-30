import React, { Component } from "react";
import GridLoader from "react-spinners/GridLoader";

export class Home extends Component {
  static displayName = Home.name;

  constructor(props) {
    super(props);
    this.packageNames = [];
    this.state = {
      data: [],
      loading: true,
      projectPath: localStorage.getItem("projectPath"),
      updating: false,
      checking: false
    };
  }

  handleChange = e => {
    localStorage.setItem("projectPath", e.target.value);
    this.setState({
      projectPath: e.target.value
    });
  };

  async getDependencies() {
    this.setState({ data: [] });
    const path = this.state.projectPath;
    const result = await fetch("/api/dependencies", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectPath: path
      })
    });
    const json = await result.json();
    this.setState({ loading: false, data: json });
  }

  async checkDependency(dependency) {
    this.packageNames = [];
    if (this.packageNames.indexOf(dependency.name) !== -1) return;
    this.packageNames.push(dependency.name);
    const result = await fetch("/api/dependencies/check", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageName: dependency.name,
        sources: this.state.data.nugetConfig
      })
    });
    const json = await result.json();
    if (!json || json.length === 0) {
      this.setState(state => {
        const projects = state.data.projects.map(iproject => {
          const dependencies = iproject.dependencies.map(idependency => {
            if (idependency.name !== dependency.name) return idependency;
            return {
              ...idependency,
              isChecked: true,
              isNotFound: true,
              latestVersion: "Not Found",
              isLatest: false
            };
          });
          return {
            ...iproject,
            dependencies: dependencies
          };
        });
        return {
          data: {
            ...state.data,
            projects
          }
        };
      });
      return;
    }
    const value = json[0];
    this.setState(state => {
      const projects = state.data.projects.map(iproject => {
        const dependencies = iproject.dependencies.map(idependency => {
          if (idependency.name !== dependency.name) return idependency;
          return {
            ...idependency,
            isChecked: true,
            source: value.source,
            latestVersion: value.version,
            isLatest: value.version === idependency.currentVersion
          };
        });
        return {
          ...iproject,
          dependencies: dependencies
        };
      });
      return {
        data: {
          ...state.data,
          projects
        },
        loading: false
      };
    });
  }

  checkLatestVersions() {
    this.setState({ checking: true });
    for (const project of this.state.data.projects) {
      for (const dependency of project.dependencies) {
        this.checkDependency(dependency);
      }
    }
  }

  getDependencyClassName(dependency) {
    if (!dependency.isChecked) return "";

    if (dependency.currentVersion === "-No Parameter-") return "bg-danger";

    if (dependency.isLatest) return "bg-success";

    if (dependency.isNotFound) return "bg-danger";

    return "bg-warning";
  }

  getDependencyTextClassName(dependency) {
    if (!dependency.isChecked) return "";

    if (dependency.isLatest) return "font-bold text-success";

    return "font-bold text-warning";
  }

  getDependenciesState() {
    const dependencyCount = this.state.data.projects
      .map(project => project.dependencies.length)
      .reduce((x, y) => x + y, 0);

    const dependencyCheckCount = this.state.data.projects
      .map(project => project.dependencies.filter(x => x.isChecked).length)
      .reduce((x, y) => x + y, 0);

    if (dependencyCount === dependencyCheckCount) {
      this.setState({ checking: false });
    }

    return `[${dependencyCheckCount}/${dependencyCount}]`;
  }

  async updateDependencies() {
    this.setState({ updating: true });
    const outdatedDependencies = this.state.data.projects
      .map(project =>
        project.dependencies
          .filter(dependency => dependency.isChecked && !dependency.isLatest)
          .map(m => {
            m.project = {
              file: project.file,
              parameterFile: project.parameterFile
            };
            return m;
          })
      )
      .flat();
    const errorProject = outdatedDependencies.find(
      x => x.project && x.project.parameterFile.startsWith("(NOT FOUND!)")
    );
    if (errorProject) {
      alert(
        "One of your projects has invalid parameter file. Fix it first to update your dependencies."
      );
      return;
    }
    const body = JSON.stringify({
      dependencies: outdatedDependencies
    });
    const updateResult = await fetch("/api/dependencies/update", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: body
    });
    const json = await updateResult.json();
    if (json.success) {
      this.getDependencies();
      this.setState({ updating: false });
      return;
    }
    alert(
      `Something is wrong with your dependencies;\n\nError Message: ${json.message}`
    );
  }

  componentDidMount() {
    if (this.state.projectPath && this.state.projectPath.length) {
      this.getDependencies();
    }
  }

  render() {
    return (
      <div>
        <div className="form-group">
          <label className="control-label">Solutions or Projects folder</label>
          <div className="input-group mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Type your project path"
              onChange={this.handleChange}
              value={this.state.projectPath}
            />
            <div className="input-group-append">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={this.getDependencies.bind(this)}
              >
                Find
              </button>{" "}
              <button
                className="btn btn-warning"
                type="button"
                onClick={this.checkLatestVersions.bind(this)}
              >
                Check
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={this.updateDependencies.bind(this)}
              >
                Update
              </button>
            </div>
          </div>
        </div>
        {this.state.updating && (
          <div className="card mb-3">
            <div className="card-body d-flex justify-content-center align-items-center">
              <GridLoader sizeUnit={"px"} size={8} color={"#2DA74E"} />
              <span className="ml-2">Updating dependencies...</span>
            </div>
          </div>
        )}
        {this.state.checking && (
          <div className="card mb-3">
            <div className="card-body d-flex justify-content-center align-items-center">
              <GridLoader sizeUnit={"px"} size={8} color={"#f00"} />
              <span className="ml-2">
                {this.getDependenciesState()} Checking dependencies...
              </span>
            </div>
          </div>
        )}
        {this.state.data && this.state.data.projects && (
          <div className="row">
            <div className="col-sm-6 col-lg-3 mb-3 mb-sm-3">
              <div className="card">
                <div className="card-body py-0 pb-2">
                  <span className="display-4">
                    {this.state.data.projects.length}
                  </span>
                  <h5 className="mb-0 text-primary">Project</h5>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3 mb-3 mb-sm-3">
              <div className="card">
                <div className="card-body py-0 pb-2">
                  <span className="display-4">
                    {this.state.data.projects
                      .map(project => project.dependencies.length)
                      .reduce((x, y) => x + y, 0)}
                  </span>
                  <h5 className="mb-0 text-warning">Dependencies</h5>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3 mb-3">
              <div className="card">
                <div className="card-body py-0 pb-2">
                  <span className="display-4">
                    {this.state.data.projects
                      .map(
                        project =>
                          project.dependencies.filter(
                            dependency => !dependency.isLatest
                          ).length
                      )
                      .reduce((x, y) => x + y, 0)}
                  </span>
                  <h5 className="mb-0 text-danger">Outdated</h5>
                </div>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3 mb-3">
              <div className="card">
                <div className="card-body py-0 pb-2">
                  <span className="display-4">
                    {this.state.data.projects
                      .map(
                        project =>
                          project.dependencies.filter(
                            dependency => dependency.isLatest
                          ).length
                      )
                      .reduce((x, y) => x + y, 0)}
                  </span>
                  <h5 className="mb-0 text-success">Up to date</h5>
                </div>
              </div>
            </div>
          </div>
        )}
        {this.state.data &&
          this.state.data.projects &&
          this.state.data.projects
            .filter(item => item.dependencies.length)
            .map(item => (
              <div className="card mb-3 shadow-sm" key={item.file}>
                <div className="card-body p-2">
                  <h5 className="mb-0">
                    <span>{item.name}</span>
                    <span
                      className="mt-1 d-block text-muted"
                      style={{ fontSize: "9pt" }}
                    >
                      {item.file}
                    </span>
                    {item.parameterFile && (
                      <span
                        className={
                          "mt-1 d-block " +
                          (item.parameterFile.indexOf("(NOT FOUND!)") === 0
                            ? "text-danger"
                            : "text-primary")
                        }
                        style={{ fontSize: "9pt" }}
                      >
                        {item.parameterFile}
                      </span>
                    )}
                  </h5>
                </div>
                <table className="table table-hover table-sm mb-0 text-monospace">
                  <thead>
                    <tr>
                      <th style={{ width: "20px" }} className="text-center">
                        #
                      </th>
                      <th style={{ width: "70%" }}>Package</th>
                      <th style={{ width: "10%" }} className="text-center">
                        Version
                      </th>
                      <th style={{ width: "10%" }} className="text-center">
                        Latest
                      </th>
                      <th style={{ width: "10%" }} className="text-center">
                        Is Latest
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.dependencies.map(dependency => (
                      <tr key={`${item.file}:${dependency.name}`}>
                        <td
                          className={this.getDependencyClassName(dependency)}
                        ></td>
                        <td>
                          <a href={`https://www.nuget.org/packages/${dependency.name}/`} target="_blank">{dependency.name}</a>
                          {dependency.isParameter && (
                            <small className="d-block text-muted">
                              Parameter: $({dependency.parameterName})
                            </small>
                          )}
                        </td>
                        <td className="text-center">
                          <span
                            className={
                              (dependency.isParameter ? "text-primary" : "",
                              dependency.currentVersion === "-No Parameter-"
                                ? "text-danger"
                                : "")
                            }
                          >
                            {dependency.currentVersion}
                          </span>
                        </td>
                        <td className="text-center">
                          {dependency.isChecked
                            ? dependency.latestVersion
                            : "..."}
                        </td>
                        <td className="text-center">
                          <span
                            className={this.getDependencyTextClassName(
                              dependency
                            )}
                          >
                            {!dependency.isChecked
                              ? "..."
                              : dependency.isLatest
                              ? "Yes"
                              : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        <pre className="d-none">{JSON.stringify(this.state.data, true, 4)}</pre>
      </div>
    );
  }
}
